<template>
  <div class="h-full flex flex-col bg-white text-gray-900 relative">
    <div class="h-12 shrink-0 flex items-center justify-between px-4 bg-white/70 backdrop-blur-xl border-b border-gray-100" data-window-drag>
      <div class="text-sm font-semibold tracking-tight">{{ `打开方式` }}</div>
    </div>

    <div class="flex-1 overflow-hidden">
      <n-scrollbar content-style="padding: 1rem;">
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="app in orderedApps"
            :key="app.id"
            type="button"
            class="group flex items-center gap-3 px-3 py-2 rounded-2xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors text-left disabled:opacity-50 disabled:hover:bg-white"
            :disabled="!target"
            @click="openWith(app.id)"
          >
            <div class="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center overflow-hidden">
              <img v-if="app.iconImage" :src="app.iconImage" class="w-6 h-6 object-cover rounded-lg" />
              <AppWindow v-else :size="18" stroke-width="1.6" class="text-gray-500" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-[13px] font-semibold text-gray-900 truncate">{{ appLabel(app) }}</div>
              <div class="text-xs text-gray-400 truncate">{{ app.id }}</div>
            </div>
          </button>
        </div>
      </n-scrollbar>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue';
import { AppWindow } from 'lucide-vue-next';
import { NScrollbar } from 'naive-ui';
import { isDirectoryFile, useOs } from '@/os';

const props = defineProps({
  files: {
    type: Array,
    required: true
  },
  componentProps: { type: Object, default: () => ({}) }
});

const os = useOs();

const appLabel = (app) => {
  return String(app?.title || app?.name || app?.id || '');
};

const unwrap = (v) => (v && typeof v === 'object' && 'value' in v ? v.value : v);

const closeSelf = () => {
  os.window.close();
  if (os.window?.id) return;
  const fallbackId = unwrap(os.stores.windows.activeWindowId);
  if (fallbackId) os.stores.windows.closeWindow?.(fallbackId);
};

const target = computed(() => (Array.isArray(props.files) ? props.files[0] : null));

const getFileExtension = (file) => {
  const name = String(file?.name || file?.path || '');
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(idx + 1).toLowerCase() : '';
};

const getCandidateApps = (file) => {
  const apps = Object.values(os.apps || {}).filter(Boolean);
  const isDir = isDirectoryFile?.(file) ?? false;
  const normalizedType = isDir ? 'directory' : (file?.type || 'file');
  const ext = isDir ? '' : getFileExtension(file);

  const candidates = apps
    .filter((app) => {
      if (!app?.component) return false;
      if (app.id === 'open-with') return false;
      if (!os.stores.auth.hasRole?.(app.role || 'user')) return false;

      const supports = app?.supports;
      if (!supports) return false;
      const types = supports.types;
      if (Array.isArray(types) && types.includes(normalizedType)) return true;
      if (isDir || !ext) return false;
      const groups = supports.extensionGroups;
      if (!Array.isArray(groups)) return false;
      return groups.some((g) => {
        const exts = g?.extensions;
        if (Array.isArray(exts)) return exts.includes(ext);
        if (exts && typeof exts.has === 'function') return exts.has(ext);
        return false;
      });
    })
    .sort((a, b) => {
      const pa = Number.isFinite(a?.supports?.priority) ? a.supports.priority : 0;
      const pb = Number.isFinite(b?.supports?.priority) ? b.supports.priority : 0;
      if (pa !== pb) return pb - pa;
      return appLabel(a).localeCompare(appLabel(b));
    });

  return candidates;
};

const allowedApps = computed(() => {
  return (Object.values(os.apps) || [])
    .filter((app) => app?.component && app.id !== 'open-with' && os.stores.auth.hasRole?.(app.role || 'user'))
    .sort((a, b) => appLabel(a).localeCompare(appLabel(b)));
});

const candidateApps = computed(() => {
  if (!target.value) return [];
  return getCandidateApps(target.value);
});

const orderedApps = computed(() => {
  const all = allowedApps.value.slice();
  const candidates = candidateApps.value;
  if (candidates.length === 0) return all;

  const rank = new Map();
  candidates.forEach((a, i) => rank.set(a.id, i));
  return all.sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id) : Infinity;
    const rb = rank.has(b.id) ? rank.get(b.id) : Infinity;
    if (ra !== rb) return ra - rb;
    return appLabel(a).localeCompare(appLabel(b));
  });
});

const openWith = (appId) => {
  if (!target.value) return;
  os.stores.windows.openFile?.(target.value, appId);
  closeSelf();
};

const onKeyDown = (e) => {
  const tag = String(e?.target?.tagName || '').toUpperCase();
  const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  if (e.key === 'Escape') {
    if (isTyping) return;
    e.preventDefault();
    closeSelf();
    return;
  }
};

onMounted(() => window.addEventListener('keydown', onKeyDown));
onUnmounted(() => window.removeEventListener('keydown', onKeyDown));
</script>
