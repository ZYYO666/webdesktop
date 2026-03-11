<template>
  <div class="h-full flex flex-col bg-white select-none text-sm font-sans relative">
    <div class="h-12 shrink-0 flex items-center justify-between px-4 bg-white/70 backdrop-blur-xl border-b border-gray-100" data-window-drag>
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <n-button
          @click="navigateUp"
          :disabled="!canNavigateUp"
          quaternary
          circle
          size="small"
          class="text-gray-500 hover:text-gray-900"
        >
          <template #icon>
            <n-icon :size="18">
              <ArrowUp />
            </n-icon>
          </template>
        </n-button>

        <div class="flex items-center gap-1.5 min-w-0 overflow-hidden">
          <n-button
            text
            size="small"
            class="!text-gray-500 hover:!text-gray-900 font-semibold"
            @click="navigateTo('/')"
          >
            {{ `文件` }}
          </n-button>
          <template v-for="(part, index) in pathParts" :key="part.fullPath">
            <span class="text-gray-300">/</span>
            <n-button
              text
              size="small"
              class="truncate !text-gray-500 hover:!text-gray-900"
              :class="index === pathParts.length - 1 ? 'font-semibold' : 'font-normal'"
              @click="navigateTo(part.fullPath)"
            >
              {{ part.name }}
            </n-button>
          </template>
        </div>
      </div>

      <div class="flex items-center gap-2 flex-shrink-0">
        <n-input
          v-model:value="searchQuery"
          size="small"
          clearable
          :placeholder="`搜索`"
          class="w-52 bg-gray-100/50 border-transparent hover:bg-gray-100 focus:bg-white text-[13px] !rounded-lg"
        >
          <template #prefix>
            <Search :size="14" class="text-gray-400" />
          </template>
        </n-input>
      </div>
    </div>

    <div class="flex-1 overflow-hidden flex">
      <div class="w-44 shrink-0 border-r border-gray-100 p-3">
        <div class="flex flex-col gap-1">
          <button
            v-for="shortcut in shortcuts"
            :key="shortcut.path"
            class="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors text-left"
            :class="currentPath === shortcut.path ? 'bg-gray-100 text-gray-900' : 'hover:bg-gray-50 text-gray-700'"
            @click="navigateTo(shortcut.path)"
            type="button"
          >
            <component :is="shortcut.icon" :size="18" class="text-gray-500" />
            <span class="text-[13px] font-medium truncate">{{ shortcut.label }}</span>
          </button>
        </div>
      </div>

      <div class="flex-1 flex flex-col relative min-w-0">
        <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          <n-spin size="large" />
        </div>

        <div v-else-if="displayItems.length === 0" class="flex flex-col items-center justify-center h-full text-gray-300 gap-4">
          <n-empty :description="searchQuery ? `无匹配结果` : `未找到项目`">
            <template #icon>
              <n-icon :size="48" stroke-width="1.5"><FolderOpen /></n-icon>
            </template>
          </n-empty>
        </div>

        <div v-else class="flex-1 overflow-y-auto p-3">
          <div class="flex flex-col gap-1">
            <button
              v-for="item in displayItems"
              :key="item.path"
              class="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors text-left"
              :class="selectedItem?.path === item.path ? 'bg-gray-100' : 'hover:bg-gray-50'"
              @click="selectItem(item)"
              @dblclick="handleDoubleClick(item)"
              type="button"
            >
              <div class="w-9 h-9 rounded-lg border border-gray-100 bg-white flex items-center justify-center overflow-hidden">
                <div
                  v-if="iconFor(item)?.kind === 'svg'"
                  class="w-full h-full flex items-center justify-center rounded-md"
                  :class="iconFor(item)?.bgClass || ''"
                >
                  <component :is="iconFor(item)?.icon" :size="20" stroke-width="1.8" :class="iconFor(item)?.fgClass || ''" />
                </div>
                <img
                  v-else
                  :src="iconSrcFor(item)"
                  class="w-full h-full object-cover rounded-md"
                  :alt="item.name"
                  loading="lazy"
                />
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-[13px] font-semibold text-gray-900 truncate">{{ item.name }}</div>
                <div class="text-xs text-gray-400 truncate">
                  {{ item.type === 'directory' ? `文件夹` : item.path }}
                </div>
              </div>
              <div v-if="selectedItem?.path === item.path" class="text-gray-900">
                <Check :size="16" stroke-width="2" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="h-16 shrink-0 border-t border-gray-100 px-5 bg-white/70 backdrop-blur-xl flex items-center justify-between">
      <div class="min-w-0">
        <div class="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{{ `已选择` }}</div>
        <div class="text-[13px] font-semibold text-gray-900 truncate max-w-[320px]">
          <span v-if="selectedItem">{{ selectedItem.name }}</span>
          <span v-else class="text-gray-300">{{ `none` }}</span>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <n-button size="small" @click="handleCancel">{{ `取消` }}</n-button>
        <n-button
          size="small"
          type="primary"
          color="black"
          :disabled="!canSelect"
          @click="confirmSelection"
          class="!px-4"
        >
          {{ selectDirectory ? `选择文件夹` : `选择文件` }}
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, markRaw } from 'vue';
import { ArrowUp, Check, FolderOpen, Home, Image, FileText, Monitor, Search } from 'lucide-vue-next';
import { NButton, NIcon, NSpin, NEmpty, NInput } from 'naive-ui';
import { useOs } from '@/os';

const props = defineProps({
  files: { type: Array, default: () => [] },
  componentProps: { type: Object, default: () => ({}) }
});

const os = useOs();
const api = os.api;
const { toast } = os.ui;
const emit = defineEmits(['select', 'cancel']);

const initialPath = computed(() => props.componentProps?.initialPath || '/');
const currentPath = ref(initialPath.value);
const items = ref([]);
const loading = ref(false);
const selectedItem = ref(null);
const searchQuery = ref('');

const shortcuts = computed(() => [
  { label: `主页`, path: '/', icon: markRaw(Home) },
  { label: `桌面`, path: '/desktop', icon: markRaw(Monitor) },
  { label: `照片`, path: '/photos', icon: markRaw(Image) },
  { label: `文档`, path: '/documents', icon: markRaw(FileText) },
]);

const pathParts = computed(() => {
  if (!currentPath.value || currentPath.value === '/') return [];
  const parts = currentPath.value.split('/').filter(p => p);
  let accumulated = '';
  return parts.map(p => {
    accumulated += '/' + p;
    return { name: p, fullPath: accumulated };
  });
});

const selectDirectory = computed(() => !!props.componentProps?.selectDirectory);

const canSelect = computed(() => {
  if (!selectedItem.value) return false;
  if (selectDirectory.value) {
    return selectedItem.value.type === 'directory';
  }
  return selectedItem.value.type !== 'directory';
});

const canNavigateUp = computed(() => {
  const p = String(currentPath.value || '');
  return !!p && p !== '/';
});

const allowedExtensions = computed(() => {
  const list = Array.isArray(props.componentProps?.allowedTypes) ? props.componentProps.allowedTypes : [];
  return new Set(list.map((e) => String(e || '').toLowerCase()).filter(Boolean));
});

const fetchFiles = async (path) => {
  loading.value = true;
  selectedItem.value = null;
  try {
    const files = await api.getList(path);
    
    const sorted = files.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });

    if (selectDirectory.value) {
      items.value = sorted.filter((f) => f?.type === 'directory');
      return;
    }

    if (allowedExtensions.value.size > 0) {
      items.value = sorted.filter((f) => {
        if (f?.type === 'directory') return true;
        const name = String(f?.name || '');
        const idx = name.lastIndexOf('.');
        const ext = idx > 0 ? name.slice(idx + 1).toLowerCase() : '';
        return allowedExtensions.value.has(ext);
      });
      return;
    }

    items.value = sorted;
  } catch (err) {
    toast.error(err?.message || '加载失败');
    items.value = [];
  } finally {
    loading.value = false;
  }
};

const navigateTo = (path) => {
  currentPath.value = path;
};

const navigateUp = () => {
  if (!canNavigateUp.value) return;
  const parts = currentPath.value.split('/').filter(p => p);
  parts.pop();
  currentPath.value = parts.length > 0 ? '/' + parts.join('/') : '/';
};

const selectItem = (item) => {
  selectedItem.value = item;
};

const handleDoubleClick = (item) => {
  if (item.type === 'directory') {
    navigateTo(item.path);
  } else if (!selectDirectory.value) {
    selectedItem.value = item;
    confirmSelection();
  }
};

const iconFor = (file) => os.files.getIcon(file);
const iconSrcFor = (file) => {
  const icon = iconFor(file);
  if (!icon || icon.kind === 'svg') return '';
  return icon.src || icon.iconImage || '';
};

const confirmSelection = () => {
    if (canSelect.value) {
      if (typeof props.componentProps?.onSelect === 'function') {
        props.componentProps.onSelect(selectedItem.value);
      } else {
        emit('select', selectedItem.value);
      }
    }
  };

  const handleCancel = () => {
    if (typeof props.componentProps?.onCancel === 'function') {
      props.componentProps.onCancel();
    } else {
      emit('cancel');
    }
  };

const displayItems = computed(() => {
  const q = String(searchQuery.value || '').trim().toLowerCase();
  if (!q) return items.value;
  return items.value.filter((it) => String(it?.name || '').toLowerCase().includes(q));
});

watch(currentPath, (newPath) => fetchFiles(newPath));
onMounted(() => fetchFiles(currentPath.value));

const onKeyDown = (e) => {
  const tag = String(e?.target?.tagName || '').toUpperCase();
  const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  if (e.key === 'Escape') {
    if (isTyping) return;
    e.preventDefault();
    handleCancel();
    return;
  }
  if (e.key === 'Enter') {
    if (isTyping) return;
    if (!canSelect.value) return;
    e.preventDefault();
    confirmSelection();
  }
};

onMounted(() => window.addEventListener('keydown', onKeyDown));
onUnmounted(() => window.removeEventListener('keydown', onKeyDown));
</script>
