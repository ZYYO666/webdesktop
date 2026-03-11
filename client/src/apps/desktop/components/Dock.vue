<template>
  <div class="pointer-events-none" :class="[dockOuterClass, isLaunchpadOpen ? 'z-6500' : 'z-50']">
    <div
      data-taskbar-root="1"
      :data-dock-position="normalizedDockPosition"
      class="pointer-events-auto"
      :class="dockRootClass"
      @dragover.prevent
      @drop="handleDrop"
    >
      <div :class="dockFrameClass">
        <div
          ref="dockSurfaceRef"
          data-dock-surface="1"
          :class="dockSurfaceClass"
        >
          <div class="absolute inset-0 pointer-events-none rounded-[18px] overflow-hidden"></div>
          <button
            :ref="(el) => setItemEl(el, 'launchpad')"
            data-id="launchpad"
            type="button"
            class="dock-item relative z-10 h-10 w-10 rounded-2xl flex items-center justify-center transition-all duration-150 hover:scale-105 hover:bg-white/15 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 group"
            @mouseenter="setTooltip('Start', 'launchpad')"
            @mousemove="moveTooltip('launchpad')"
            @mouseleave="clearTooltip"
            @click="toggleLaunchpad"
          >
            <img src="/LaunchNext.png" class="w-[26px] h-[26px] transition-transform duration-150 group-active:scale-90 drop-shadow-[0_6px_16px_rgba(0,0,0,0.25)]" />
            <span
              class="absolute left-1/2 -translate-x-1/2 -bottom-[5px] h-[3px] rounded-full transition-all duration-200"
              :class="isLaunchpadOpen ? 'w-[4px] bg-black/40 opacity-100' : 'w-[3px] bg-black/30 opacity-0'"
            ></span>
          </button>

          <div class="relative z-10 bg-black/10" :class="dockSeparatorClass"></div>

          <Teleport to="body">
            <div
              v-if="tooltip.text"
              class="fixed z-100000 px-2.5 py-1 bg-neutral-800/90 text-white text-[12px] font-medium tracking-wide rounded-md whitespace-nowrap backdrop-blur-md border border-white/10 pointer-events-none transition-opacity duration-150 shadow-lg"
              :style="tooltipStyle"
            >
              {{ tooltip.text }}
            </div>
          </Teleport>

          <Teleport to="body">
            <Transition
              enter-active-class="transition duration-220 ease-out"
              enter-from-class="opacity-0 translate-y-3"
              enter-to-class="opacity-100 translate-y-0"
              leave-active-class="transition duration-160 ease-in"
              leave-from-class="opacity-100 translate-y-0"
              leave-to-class="opacity-0 translate-y-2"
            >
              <div
                v-if="isLaunchpadOpen"
                ref="launchpadPanelRef"
                class="fixed z-9000 bg-white/55 backdrop-blur-xl border border-white/35 rounded-[14px] overflow-hidden flex flex-col shadow-xl"
                :style="launchpadPanelStyle"
              >
                <div class="relative flex-1 min-h-0 overflow-auto p-4">
                  <div class="grid gap-3 place-items-center" :style="launchpadGridStyle">
                    <button
                      v-for="app in sortedLaunchpadApps"
                      :key="app.id"
                      type="button"
                      class="group flex flex-col items-center p-2 rounded-xl hover:bg-black/5 active:scale-[0.985] transition"
                      @click="launchFromLaunchpad(app)"
                    >
                      <img :src="app.iconImage" class="w-10 h-10 object-contain" />
                      <span class="mt-1 text-[10px] leading-tight text-black/70 text-center line-clamp-2">
                        {{ appLabel(app) }}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </Transition>
          </Teleport>

          <div class="relative z-10 no-scrollbar px-0.5 min-w-[120px]" :class="dockItemsContainerClass">
          <button
            v-for="item in taskbarItems"
            :key="item.id"
            :ref="(el) => setItemEl(el, item.id)"
            :data-id="item.id"
            type="button"
            class="dock-item relative h-10 w-10 rounded-2xl flex items-center justify-center transition-all duration-150 hover:scale-105 hover:bg-white/15 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 shrink-0 group"
            @mouseenter="setTooltip(itemTooltip(item), item.id)"
            @mousemove="moveTooltip(item.id)"
            @mouseleave="clearTooltip"
            @click="handleTaskbarClick(item)"
          >
            <span class="w-7 h-7 rounded-xl overflow-hidden flex items-center justify-center transition-transform duration-150 group-active:scale-90 drop-shadow-[0_6px_14px_rgba(0,0,0,0.22)]">
              <img v-if="item.iconImage" :src="item.iconImage" class="w-full h-full object-contain" />
              <template v-else-if="item.file">
                <div
                  v-if="iconFor(item.file)?.kind === 'svg'"
                  class="w-full h-full flex items-center justify-center rounded-md"
                  :class="iconFor(item.file)?.bgClass || ''"
                >
                  <component :is="iconFor(item.file)?.icon" :size="26" stroke-width="1.8" :class="iconFor(item.file)?.fgClass || ''" />
                </div>
                <img
                  v-else
                  :src="iconFor(item.file)?.src"
                  class="w-full h-full object-cover rounded-md"
                  :alt="item.name"
                  loading="lazy"
                />
              </template>
            </span>

            <span
              class="absolute left-1/2 -translate-x-1/2 -bottom-[5px] h-[3px] rounded-full transition-all duration-200"
              :class="taskbarIndicatorClass(item)"
            ></span>
          </button>
        </div>

          <div class="relative z-10 bg-black/10" :class="dockSeparatorClass"></div>

          <button
            :ref="(el) => setItemEl(el, 'fullscreen')"
            data-id="fullscreen"
            type="button"
            class="dock-item relative z-10 h-10 w-10 rounded-2xl flex items-center justify-center transition-all duration-150 hover:scale-105 hover:bg-white/15 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 group"
            @mouseenter="setTooltip(isFullscreen ? '退出全屏' : '全屏', 'fullscreen')"
            @mousemove="moveTooltip('fullscreen')"
            @mouseleave="clearTooltip"
            @click="toggleFullscreen"
          >
            <Minimize2 v-if="isFullscreen" :size="20" class="text-black/70" />
            <Maximize2 v-else :size="20" class="text-black/70" />
          </button>

          <div class="relative z-10 min-w-[70px] px-2 rounded-2xl flex flex-col items-center justify-center text-black/80 select-none hover:bg-white/15 transition-colors duration-150 shadow-inner shadow-white/50" :class="dockClockClass">
            <div class="text-[13px] leading-none font-semibold tabular-nums tracking-wide">{{ timeLabel }}</div>
            <div class="mt-0.5 text-[10px] leading-none text-black/50 tabular-nums font-medium">{{ dateLabel }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { Maximize2, Minimize2 } from 'lucide-vue-next';
import { useOs } from '@/os';

const os = useOs();
const { stores, apps: APPS } = os;
const authStore = stores.auth;
const windowsStore = stores.windows;
const systemStore = stores.system;
const { activeWindows } = storeToRefs(windowsStore);
const { dockPosition, dockMode } = storeToRefs(systemStore);
const { openWindow, openFile, toggleWindow } = windowsStore;

const iconFor = (file) => os.files.getIcon(file);

const normalizedDockPosition = computed(() => {
  const p = String(dockPosition.value || '').toLowerCase();
  return (p === 'top' || p === 'right' || p === 'left' || p === 'bottom') ? p : 'bottom';
});

const normalizedDockMode = computed(() => {
  const m = String(dockMode.value || '').toLowerCase();
  return (m === 'edge' || m === 'floating') ? m : 'floating';
});

const isVerticalDock = computed(() => normalizedDockPosition.value === 'left' || normalizedDockPosition.value === 'right');

const dockOuterClass = computed(() => {
  const pos = normalizedDockPosition.value;
  if (pos === 'top') return 'fixed inset-x-0 top-0';
  if (pos === 'left') return 'fixed inset-y-0 left-0';
  if (pos === 'right') return 'fixed inset-y-0 right-0';
  return 'fixed inset-x-0 bottom-0';
});

const dockRootClass = computed(() => {
  const pos = normalizedDockPosition.value;
  const mode = normalizedDockMode.value;
  if (pos === 'top') return mode === 'edge' ? 'flex justify-center w-full' : 'flex justify-center px-3 pt-2 pb-2 w-full';
  if (pos === 'left') return mode === 'edge' ? 'flex flex-col justify-center items-center h-full' : 'flex flex-col justify-center items-center py-3 px-2 h-full';
  if (pos === 'right') return mode === 'edge' ? 'flex flex-col justify-center items-center h-full' : 'flex flex-col justify-center items-center py-3 px-2 h-full';
  return mode === 'edge' ? 'flex justify-center w-full' : 'flex justify-center px-3 pt-2 pb-2 w-full';
});

const dockFrameClass = computed(() => {
  if (isVerticalDock.value) {
    return normalizedDockMode.value === 'edge'
      ? 'h-full max-h-none'
      : 'h-fit max-h-[calc(100vh-24px)]';
  }
  return normalizedDockMode.value === 'edge'
    ? 'w-full max-w-none'
    : 'w-fit max-w-[calc(100vw-24px)]';
});

const dockSurfaceClass = computed(() => {
  const base = 'relative bg-white/55 backdrop-blur-2xl border border-white/45 shadow-xl shadow-black/15 ring-1 ring-white/40 overflow-visible transition-all duration-200';
  if (isVerticalDock.value) {
    const mode = normalizedDockMode.value;
    return [
      base,
      'flex flex-col items-center',
      mode === 'edge' ? 'h-full rounded-none py-3 w-[56px]' : 'rounded-[22px] py-2.5 w-[56px]'
    ].join(' ');
  }
  return [
    base,
    'flex items-center',
    normalizedDockMode.value === 'edge' ? 'w-full rounded-none px-3 h-[56px]' : 'rounded-[22px] px-2.5 h-[56px]'
  ].join(' ');
});

const dockSeparatorClass = computed(() => {
  return isVerticalDock.value ? 'my-1.5 w-6 h-px' : 'mx-1.5 h-6 w-px';
});

const dockItemsContainerClass = computed(() => {
  if (isVerticalDock.value) {
    const mode = normalizedDockMode.value;
    return [
      'flex flex-col items-center gap-1.5 overflow-y-auto',
      mode === 'edge' ? 'flex-1 justify-center max-h-none' : 'max-h-[calc(100vh-240px)]'
    ].join(' ');
  }
  return [
    'flex items-center gap-1.5 overflow-x-auto',
    normalizedDockMode.value === 'edge' ? 'flex-1 justify-center max-w-none' : 'max-w-[calc(100vw-240px)]'
  ].join(' ');
});

const dockClockClass = computed(() => {
  return isVerticalDock.value ? 'w-10 min-w-0 px-0 py-2' : 'h-10';
});

const isFullscreen = ref(false);

const syncFullscreen = () => {
  isFullscreen.value = !!document.fullscreenElement;
};

const toggleFullscreen = async () => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    const el = document.documentElement;
    if (!el?.requestFullscreen) return;
    await el.requestFullscreen();
  } catch {
    void 0;
  }
};

const useDockTooltip = () => {
  const tooltip = ref({ text: '', x: 0, y: 0 });
  const hoveredId = ref(null);
  const itemEls = new Map();
  let rafId = 0;
  let pendingId = null;

  const setItemEl = (el, id) => {
    if (el) itemEls.set(id, el);
  };

  const placeTooltipNear = (id) => {
    const el = itemEls.get(id);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pos = normalizedDockPosition.value;
    if (pos === 'top') {
      tooltip.value = { ...tooltip.value, x: rect.left + rect.width / 2, y: rect.bottom + 12 };
      return;
    }
    if (pos === 'left') {
      tooltip.value = { ...tooltip.value, x: rect.right + 12, y: rect.top + rect.height / 2 };
      return;
    }
    if (pos === 'right') {
      tooltip.value = { ...tooltip.value, x: rect.left - 12, y: rect.top + rect.height / 2 };
      return;
    }
    tooltip.value = { ...tooltip.value, x: rect.left + rect.width / 2, y: rect.top - 12 };
  };

  const scheduleTooltipUpdate = (id) => {
    pendingId = id;
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      if (!pendingId) return;
      placeTooltipNear(pendingId);
      pendingId = null;
    });
  };

  const setTooltip = (text, id) => {
    hoveredId.value = id;
    tooltip.value = { text, x: tooltip.value.x, y: tooltip.value.y };
    scheduleTooltipUpdate(id);
  };

  const moveTooltip = (id) => {
    if (!tooltip.value.text) return;
    scheduleTooltipUpdate(id);
  };

  const clearTooltip = () => {
    hoveredId.value = null;
    tooltip.value = { text: '', x: tooltip.value.x, y: tooltip.value.y };
    pendingId = null;
  };

  return { tooltip, hoveredId, setItemEl, setTooltip, moveTooltip, clearTooltip };
};

const useClock = () => {
  const clockNow = ref(Date.now());
  let clockTimer = null;

  const pad2 = (n) => String(n).padStart(2, '0');

  const timeLabel = computed(() => {
    const d = new Date(clockNow.value);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  });

  const dateLabel = computed(() => {
    const d = new Date(clockNow.value);
    return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
  });

  const start = () => {
    clockTimer = window.setInterval(() => {
      clockNow.value = Date.now();
    }, 60000);
  };

  const stop = () => {
    if (clockTimer) window.clearInterval(clockTimer);
    clockTimer = null;
  };

  return { timeLabel, dateLabel, start, stop };
};

const { tooltip, hoveredId, setItemEl, setTooltip, moveTooltip, clearTooltip } = useDockTooltip();
const { timeLabel, dateLabel, start: startClock, stop: stopClock } = useClock();

const tooltipStyle = computed(() => {
  const pos = normalizedDockPosition.value;
  const x = tooltip.value.x;
  const y = tooltip.value.y;
  let align = 'translate(-50%, -100%)';
  if (pos === 'top') align = 'translate(-50%, 0)';
  else if (pos === 'left') align = 'translate(0, -50%)';
  else if (pos === 'right') align = 'translate(-100%, -50%)';
  return {
    left: 0,
    top: 0,
    transform: `translate3d(${x}px, ${y}px, 0) ${align}`,
    willChange: 'transform'
  };
});

const pinnedFiles = ref([]);
const dockSurfaceRef = ref(null);
const launchpadAnchor = ref({ left: 0, top: 0, bottom: 0, width: 760, maxHeight: 520, transformOrigin: 'bottom center' });
const launchpadPanelRef = ref(null);

const appEntryById = (appId) => {
  if (!appId) return null;
  return Object.values(APPS).find((a) => a?.id === appId) || null;
};

const appLabel = (app) => {
  return String(app?.title || app?.name || app?.appId || app?.id || '');
};

const pinnedAppEntries = computed(() => {
  return Object.values(APPS)
    .filter((a) => a && a.id && a.isPin)
    .filter((a) => authStore.hasRole(a.role || 'user'))
    .sort((a, b) => appLabel(a).localeCompare(appLabel(b)));
});

const visiblePinnedApps = computed(() => {
  const pinnedApps = pinnedAppEntries.value.map((entry) => ({
    id: `pin-${entry.id}`,
    name: appLabel(entry),
    appId: entry.id,
    iconImage: entry.iconImage,
  }));

  const files = pinnedFiles.value.map((f) => ({
    id: f.id,
    name: f.name,
    file: f.file,
  }));

  return [...pinnedApps, ...files];
});

const isLaunchpadOpen = ref(false);
const launchpadExcludedIds = new Set(['属性', 'uploader', 'open-with']);

const launchpadDockGap = 10;

const updateLaunchpadAnchor = () => {
  const el = dockSurfaceRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const pos = normalizedDockPosition.value;
  if (pos === 'top') {
    const top = Math.max(0, rect.bottom + launchpadDockGap);
    const maxHeight = Math.max(220, window.innerHeight - top - 16);
    launchpadAnchor.value = {
      left: rect.left,
      top,
      bottom: 0,
      width: rect.width,
      maxHeight,
      transformOrigin: 'top center'
    };
    return;
  }
  if (pos === 'left') {
    const left = Math.max(0, rect.right + launchpadDockGap);
    const top = Math.max(16, rect.top);
    const maxHeight = Math.max(220, window.innerHeight - top - 16);
    launchpadAnchor.value = {
      left,
      top,
      bottom: 0,
      width: 420,
      maxHeight,
      transformOrigin: 'left center'
    };
    return;
  }
  if (pos === 'right') {
    const width = 420;
    const left = Math.max(0, rect.left - launchpadDockGap - width);
    const top = Math.max(16, rect.top);
    const maxHeight = Math.max(220, window.innerHeight - top - 16);
    launchpadAnchor.value = {
      left,
      top,
      bottom: 0,
      width,
      maxHeight,
      transformOrigin: 'right center'
    };
    return;
  }
  const bottom = Math.max(0, window.innerHeight - rect.top + launchpadDockGap);
  const maxHeight = Math.max(220, rect.top - launchpadDockGap - 16);
  launchpadAnchor.value = {
    left: rect.left,
    top: 0,
    bottom,
    width: rect.width,
    maxHeight,
    transformOrigin: 'bottom center'
  };
};

const launchpadPanelStyle = computed(() => {
  const a = launchpadAnchor.value;
  const pos = normalizedDockPosition.value;
  const style = {
    left: `${a.left}px`,
    width: `${a.width}px`,
    maxHeight: `${a.maxHeight}px`,
    transformOrigin: a.transformOrigin
  };
  if (pos === 'top' || pos === 'left' || pos === 'right') {
    style.top = `${a.top}px`;
    return style;
  }
  style.bottom = `${a.bottom}px`;
  return style;
});

const launchpadGridStyle = computed(() => ({
  gridTemplateColumns: 'repeat(auto-fill, minmax(68px, 1fr))',
}));

const launchpadApps = computed(() => {
  return Object.values(APPS)
    .filter((a) => a && a.id && !launchpadExcludedIds.has(a.id))
    .filter((a) => authStore.hasRole(a.role || 'user'));
});

const sortedLaunchpadApps = computed(() => {
  return [...launchpadApps.value].sort((a, b) => appLabel(a).localeCompare(appLabel(b)));
});

const taskbarItems = computed(() => {
  const pinned = visiblePinnedApps.value;
  const pinnedAppIds = new Set(pinnedAppEntries.value.map((a) => a.id));
  const runningAsApps = activeWindows.value
    .filter((w) => w?.appId && !pinnedAppIds.has(w.appId))
    .map((w) => ({ id: `app-${w.appId}`, name: w.title, appId: w.appId, iconImage: w.iconImage }));

  const unique = [];
  const seen = new Set();
  [...pinned, ...runningAsApps].forEach((it) => {
    const key = it.appId ? `app:${it.appId}` : (it.windowId ? `win:${it.windowId}` : `id:${it.id}`);
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(it);
  });
  return unique.slice(0, 16);
});

const bestWindowForApp = (appId) => {
  const wins = activeWindows.value.filter((w) => w.appId === appId);
  if (!wins.length) return null;
  return wins.reduce((top, cur) => ((cur.zIndex || 0) > (top.zIndex || 0) ? cur : top), wins[0]);
};

const openLaunchpad = async () => {
  clearTooltip();
  isLaunchpadOpen.value = true;
  await nextTick();
  updateLaunchpadAnchor();
};

const closeLaunchpad = () => {
  isLaunchpadOpen.value = false;
  clearTooltip();
};

const toggleLaunchpad = async () => {
  if (isLaunchpadOpen.value) {
    closeLaunchpad();
    return;
  }
  await openLaunchpad();
};

const openAppById = (appId) => {
  const entry = appEntryById(appId);
  if (!entry) return;
  openWindow(entry);
};

const handleTaskbarClick = (item) => {
  if (item.file) {
    if (!openFile(item.file)) {
      openWindow({
        ...APPS.OPEN_WITH,
        componentProps: { files: [{ type: item.file.type === 'directory' ? 'dir' : 'file', path: item.file.path }] }
      });
    }
    return;
  }

  if (item.windowId) {
    toggleWindow(item.windowId);
    return;
  }

  if (item.appId) {
    const win = bestWindowForApp(item.appId);
    if (win) {
      toggleWindow(win.id);
      return;
    }
    openAppById(item.appId);
  }
};

const launchFromLaunchpad = (app) => {
  const win = bestWindowForApp(app.id);
  if (win) {
    toggleWindow(win.id);
    closeLaunchpad();
    return;
  }
  openWindow(app);
  closeLaunchpad();
};

const handleDrop = (e) => {
  const raw = e.dataTransfer.getData('application/json');
  if (!raw) return;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }

  if (payload?.file) {
    if (pinnedFiles.value.some((p) => p.file?.path === payload.file.path)) return;
    pinnedFiles.value.push({ id: payload.id, name: payload.label, file: payload.file });
  }
};

const onKeydown = (e) => {
  if (!isLaunchpadOpen.value) return;
  if (e.key === 'Escape') closeLaunchpad();
};

const onLaunchpadOutsideDown = (e) => {
  if (!isLaunchpadOpen.value) return;
  const panel = launchpadPanelRef.value;
  const target = e?.target;
  if (!panel || !target) return;
  if (panel.contains(target)) return;
  closeLaunchpad();
};

const itemTooltip = (item) => {
  if (item.title) return item.title;
  return String(item?.name || item?.appId || '');
};

const taskbarIndicatorClass = (item) => {
  const activeId = windowsStore.activeWindowId;
  const activeWin = activeWindows.value.find((w) => w?.id === activeId.value) || null;
  const activeIsMinimized = !!activeWin?.isMinimized;
  const isActiveWin = !activeIsMinimized && item.windowId ? activeId.value === item.windowId : false;
  const isActiveApp = !activeIsMinimized && item.appId ? activeWindows.value.some((w) => w.appId === item.appId && w.id === activeId.value) : false;
  const hasWindowForApp = item.appId ? activeWindows.value.some((w) => w.appId === item.appId) : false;
  const hasWindowForId = item.windowId ? activeWindows.value.some((w) => w.id === item.windowId) : false;
  const hasAnyWindow = hasWindowForApp || hasWindowForId;

  if (!hasAnyWindow) {
    if (hoveredId.value === item.id) return 'w-[4px] h-[4px] bg-white/70 opacity-100';
    return 'w-0 h-[4px] opacity-0';
  }
  if (isActiveWin || isActiveApp) return 'w-[6px] h-[6px] bg-white/80 opacity-100';
  return 'w-[4px] h-[4px] bg-white/60 opacity-100';
};

const onResize = () => {
  if (!isLaunchpadOpen.value) return;
  updateLaunchpadAnchor();
};

watch(
  [normalizedDockPosition, normalizedDockMode],
  async () => {
    if (!isLaunchpadOpen.value) return;
    await nextTick();
    updateLaunchpadAnchor();
  }
);

watch(
  () => taskbarItems.value.map((i) => i.id).join('|'),
  async () => {
    if (!isLaunchpadOpen.value) return;
    await nextTick();
    updateLaunchpadAnchor();
  }
);

watch(
  () => isLaunchpadOpen.value,
  (open) => {
    if (open) window.addEventListener('mousedown', onLaunchpadOutsideDown, true);
    else window.removeEventListener('mousedown', onLaunchpadOutsideDown, true);
  },
  { immediate: true }
);

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('resize', onResize);
  document.addEventListener('fullscreenchange', syncFullscreen);
  syncFullscreen();
  startClock();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('resize', onResize);
  document.removeEventListener('fullscreenchange', syncFullscreen);
  stopClock();
});
</script>
