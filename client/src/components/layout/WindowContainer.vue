<template>
  <TransitionGroup
    enter-active-class="transition-all duration-[250ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
    leave-active-class="transition-all duration-[250ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
    enter-from-class="opacity-0 scale-95 translate-y-2.5"
    enter-to-class="opacity-100 scale-100 translate-y-0"
    leave-from-class="opacity-100 scale-100 translate-y-0"
    leave-to-class="opacity-0 scale-95 translate-y-2.5"
  >
    <!-- Snap Preview Overlay -->
    <div 
      v-if="snapPreview.visible"
      key="snap-preview"
      class="fixed bg-blue-400/20 border-2 border-blue-400/50 rounded-xl backdrop-blur-sm pointer-events-none transition-all duration-200 z-[5000]"
      :style="{
        left: 0,
        top: 0,
        transform: `translate3d(${snapPreview.x}px, ${snapPreview.y}px, 0)`,
        width: snapPreview.width + 'px',
        height: snapPreview.height + 'px'
      }"
    ></div>

    <div 
      v-for="win in activeWindows" 
      :key="win.id"
      v-show="!getWindowState(win.id).isMinimized"
      :ref="el => setWindowRef(el, win.id)"
      class="fixed flex flex-col bg-white/85 backdrop-blur-xl overflow-hidden"
      :class="[
        'rounded-xl border border-gray-200/80',
        getWindowState(win.id).isMinimized ? 'border-gray-300' : '',
        isWindowActive(win.id) ? 'shadow-2xl shadow-black/10 ring-1 ring-black/5' : 'shadow-lg shadow-black/5',
        (dragState.isDragging && dragState.id === win.id) || (resizeState.isResizing && resizeState.id === win.id)
          ? 'transition-none backdrop-blur-none bg-white/95'
          : 'transition-[left,top,width,height,opacity] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
        win.customClass || ''
      ]"
      :style="{
        left: getWindowState(win.id).x + 'px',
        top: getWindowState(win.id).y + 'px',
        width: getWindowState(win.id).width + 'px',
        height: getWindowState(win.id).height + 'px',
        zIndex: (dragState.isDragging && dragState.id === win.id) ? 5001 : win.zIndex,
        willChange: 'left, top, width, height',
        '--immersive-safe-top': win.immersive ? '48px' : '0px'
      }"
      @mousedown="(e) => { handleFocus(win.id); startDrag(e, win.id); }"
      @dblclick="(e) => handleWindowDblClick(e, win.id)"
    >
      <!-- Title Bar -->
      <div 
        class="h-11 flex items-center select-none flex-shrink-0 cursor-grab active:cursor-grabbing z-50 px-2.5 transition-colors duration-200"
        :class="[
          win.immersive 
            ? 'hidden' 
            : 'relative bg-white/50 backdrop-blur-2xl border-b border-gray-100 window-titlebar'
        ]"
        @dblclick="toggleMaximize(win.id)"
      >
        <div class="flex items-center min-w-0 flex-1" :class="{ 'opacity-0 hover:opacity-100 transition-opacity': win.immersive && win.hideTitle }">
          <div class="flex items-center gap-2 min-w-0 pointer-events-none">
            <img v-if="win.iconImage" :src="win.iconImage" class="w-[16px] h-[16px] object-cover rounded-[4px] opacity-75" />
            <component v-else :is="AppWindowIcon" :size="16" class="text-gray-500/80" />
            <span class="text-[14px] leading-none font-semibold text-gray-800/85 truncate">{{ win.title }}</span>
          </div>
        </div>

        <div class="ml-auto flex items-center gap-2 px-1 py-1 -mr-1" @mousedown.stop>
          <button
            v-if="win.minimizable !== false"
            type="button"
            class="w-7 h-7 rounded-[8px] flex items-center justify-center text-gray-700/80 hover:bg-black/5 active:bg-black/10 transition-colors disabled:opacity-60"
            :title="getWindowState(win.id).isMinimized ? `还原` : `最小化`"
            @click="toggleMinimize(win.id)"
          >
            <Minus :size="14" />
          </button>

          <button
            v-if="win.maximizable !== false"
            type="button"
            class="w-7 h-7 rounded-[8px] flex items-center justify-center text-gray-700/80 hover:bg-black/5 active:bg-black/10 transition-colors disabled:opacity-60"
            :title="getWindowState(win.id).isMaximized ? `还原` : `最大化`"
            :disabled="getWindowState(win.id).isMinimized"
            @click="toggleMaximize(win.id)"
          >
            <component :is="getWindowState(win.id).isMaximized ? Copy : Square" :size="14" />
          </button>

          <button
            v-if="!win.hideWindowCloseButton"
            type="button"
            class="w-7 h-7 rounded-[8px] flex items-center justify-center text-gray-700/80 hover:bg-red-500/90 hover:text-white active:bg-red-600 transition-colors"
            :title="`关闭`"
            @click="closeWindow(win.id)"
          >
            <X :size="14" />
          </button>
        </div>
      </div>

      <div
        v-if="win.immersive"
        class="absolute top-0 left-0 right-0 z-50 px-3 h-12 flex items-center justify-between gap-3 pointer-events-none"
      >
        <div v-if="!win.hideTitle" class="flex items-center gap-2 min-w-0 pointer-events-none">
          <img v-if="win.iconImage" :src="win.iconImage" class="w-[16px] h-[16px] object-cover rounded-[4px] opacity-75" />
          <component v-else :is="AppWindowIcon" :size="16" class="text-gray-500/80" />
          <span class="text-[13px] leading-none font-semibold text-gray-800/85 truncate">{{ win.title }}</span>
        </div>

        <div class="ml-auto flex items-center gap-2 pointer-events-auto" @mousedown.stop>
          <button
            v-if="win.minimizable !== false"
            type="button"
            class="w-7 h-7 rounded-[8px] flex items-center justify-center text-gray-700/80 hover:bg-black/5 active:bg-black/10 transition-colors disabled:opacity-60"
            :title="getWindowState(win.id).isMinimized ? `还原` : `最小化`"
            @click="toggleMinimize(win.id)"
          >
            <Minus :size="14" />
          </button>

          <button
            v-if="win.maximizable !== false"
            type="button"
            class="w-7 h-7 rounded-[8px] flex items-center justify-center text-gray-700/80 hover:bg-black/5 active:bg-black/10 transition-colors disabled:opacity-60"
            :title="getWindowState(win.id).isMaximized ? `还原` : `最大化`"
            :disabled="getWindowState(win.id).isMinimized"
            @click="toggleMaximize(win.id)"
          >
            <component :is="getWindowState(win.id).isMaximized ? Copy : Square" :size="14" />
          </button>

          <button
            v-if="!win.hideWindowCloseButton"
            type="button"
            class="w-7 h-7 rounded-[8px] flex items-center justify-center text-gray-700/80 hover:bg-red-500/90 hover:text-white active:bg-red-600 transition-colors"
            :title="`关闭`"
            @click="closeWindow(win.id)"
          >
            <X :size="14" />
          </button>
        </div>
      </div>

      <!-- Content Area -->
      <div 
        class="min-h-0 min-w-0 overflow-hidden relative app-container"
        :class="[
          win.immersive ? 'h-full w-full bg-white' : 'flex-1 bg-gray-100'
        ]"
      >
        <DirectAppHost
          :window-id="win.id"
          :app-id="win.appId"
          :files="(win.componentProps && win.componentProps.files) ? win.componentProps.files : []"
          :component-props="win.componentProps || {}"
          :window-width="getWindowState(win.id).width"
          :window-height="getWindowState(win.id).height"
        />
        
        <!-- Resizer Handle -->
        <div 
          v-if="!getWindowState(win.id).isMaximized && win.resizable !== false"
          class="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize z-50 flex items-end justify-end p-1"
          @mousedown.stop.prevent="(e) => startResize(e, win.id)"
        >
           <div class="w-2 h-2 bg-gray-300 rounded-br-sm"></div>
        </div>
      </div>
    </div>
  </TransitionGroup>
</template>

<script setup>
import { reactive, watch, onUnmounted, ref, onMounted, defineComponent, h } from 'vue';
import { storeToRefs } from 'pinia';
import { useWindowStore } from '../../os/store/windows';
import { useSystemStore } from '../../os/store/system';
import { X, Square, Minus, Copy, AppWindow as AppWindowIcon } from 'lucide-vue-next';
import ContextMenu from '../ui/ContextMenu.vue';
import { APPS } from '@/os/registry/index';
import { createOs, provideOs, toAppKey } from '@/os';

const DirectAppHost = defineComponent({
  name: 'DirectAppHost',
  props: {
    windowId: { type: String, required: true },
    appId: { type: String, required: true },
    files: { type: Array, default: () => [] },
    componentProps: { type: Object, default: () => ({}) },
    windowWidth: { type: Number, default: 0 },
    windowHeight: { type: Number, default: 0 },
  },
  setup(props) {
    const resolveAppById = (id) => {
      const key = toAppKey(id);
      return APPS[key] || Object.values(APPS).find((a) => a?.id === id) || null;
    };
    const appEntry = resolveAppById(props.appId);
    const os = createOs({ windowId: props.windowId });
    provideOs(os);
    if (!appEntry || !appEntry.component) {
      return () => h('div', { class: 'h-full w-full flex items-center justify-center text-sm text-gray-500 bg-white' }, '应用不存在或未注册组件');
    }
    return () =>
      h('div', { class: 'h-full w-full' }, [
        h(appEntry.component, {
          files: Array.isArray(props.files) ? props.files : [],
          componentProps: (props.componentProps && typeof props.componentProps === 'object') ? props.componentProps : {},
          windowWidth: props.windowWidth,
          windowHeight: props.windowHeight,
        }),
        h(ContextMenu),
      ]);
  }
});

const windowStore = useWindowStore();
const { activeWindows, activeWindowId } = storeToRefs(windowStore);
const { closeWindow, bringToFront } = windowStore;

const systemStore = useSystemStore();
const { fullscreenCoverDock, dockPosition, dockMode } = storeToRefs(systemStore);

const EDGE_GAP_PX = 8;
const TITLEBAR_HEIGHT_PX = 44;
const dockInsets = ref({ top: 0, bottom: 0, left: 0, right: 0 });

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

const clampTitlebarY = (y) => {
  const inset = dockInsets.value;
  const minY = EDGE_GAP_PX + (inset.top || 0);
  const maxY = Math.max(minY, window.innerHeight - (inset.bottom || 0) - TITLEBAR_HEIGHT_PX - EDGE_GAP_PX);
  return clamp(y, minY, maxY);
};

const normalizeDockPosition = (pos) => {
  const p = String(pos || '').toLowerCase();
  return (p === 'top' || p === 'right' || p === 'left' || p === 'bottom') ? p : 'bottom';
};

const computeDockInsets = (coverDock) => {
  const hasDock = window.innerWidth >= 768 && !!document.querySelector('.dock-item');
  if (!hasDock) return { top: 0, bottom: 0, left: 0, right: 0 };
  if (coverDock) return { top: 0, bottom: 0, left: 0, right: 0 };

  const pos = normalizeDockPosition(dockPosition.value);
  const dockSurface = document.querySelector('[data-dock-surface="1"]');
  if (dockSurface) {
    const rect = dockSurface.getBoundingClientRect();
    if (pos === 'top') return { top: Math.max(0, Math.round(rect.bottom)), bottom: 0, left: 0, right: 0 };
    if (pos === 'left') return { top: 0, bottom: 0, left: Math.max(0, Math.round(rect.right)), right: 0 };
    if (pos === 'right') return { top: 0, bottom: 0, left: 0, right: Math.max(0, Math.round(window.innerWidth - rect.left)) };
    return { top: 0, bottom: Math.max(0, Math.round(window.innerHeight - rect.top)), left: 0, right: 0 };
  }

  const dockRoot = document.querySelector('[data-taskbar-root="1"]');
  if (!dockRoot) {
    if (pos === 'top') return { top: 72, bottom: 0, left: 0, right: 0 };
    if (pos === 'left') return { top: 0, bottom: 0, left: 72, right: 0 };
    if (pos === 'right') return { top: 0, bottom: 0, left: 0, right: 72 };
    return { top: 0, bottom: 72, left: 0, right: 0 };
  }

  const rect = dockRoot.getBoundingClientRect();
  if (pos === 'top') return { top: Math.max(0, Math.round(rect.bottom)), bottom: 0, left: 0, right: 0 };
  if (pos === 'left') return { top: 0, bottom: 0, left: Math.max(0, Math.round(rect.right)), right: 0 };
  if (pos === 'right') return { top: 0, bottom: 0, left: 0, right: Math.max(0, Math.round(window.innerWidth - rect.left)) };
  return { top: 0, bottom: Math.max(0, Math.round(window.innerHeight - rect.top)), left: 0, right: 0 };
};

const applyDockOffset = () => {
  dockInsets.value = computeDockInsets(fullscreenCoverDock.value);

  Object.values(windowStates).forEach((state) => {
    if (!state) return;
    state.y = clampTitlebarY(state.y);
    if (!state || !state.isMaximized) return;
    const inset = dockInsets.value;
    const left = inset.left || 0;
    const right = inset.right || 0;
    const top = inset.top || 0;
    const bottom = inset.bottom || 0;
    state.x = EDGE_GAP_PX + left;
    state.y = EDGE_GAP_PX + top;
    state.width = Math.max(0, window.innerWidth - left - right - EDGE_GAP_PX * 2);
    state.height = Math.max(0, window.innerHeight - top - bottom - EDGE_GAP_PX * 2);
  });
};

watch([fullscreenCoverDock, dockPosition, dockMode], () => {
  applyDockOffset();
});

// Store window state (x, y, width, height, etc.) by ID
const windowStates = reactive({});

// Refs for window elements if needed
const windowRefs = new Map();
const setWindowRef = (el, id) => {
  if (el) windowRefs.set(id, el);
  else windowRefs.delete(id);
};

// --- Window Management Logic ---

const getWindowState = (id) => {
  if (!windowStates[id]) {
     // Initialize default state if missing
     const win = activeWindows.value.find(w => w.id === id);
     
     // Default size/pos
     let w = win?.width || 800;
     let h = win?.height || 600;
     
     // Center
     let x = (window.innerWidth - w) / 2;
     let y = (window.innerHeight - h) / 2;

     // Stagger slightly if multiple windows
     const count = activeWindows.value.length;
     if (count > 1) {
       x += (count * 20) % 100;
       y += (count * 20) % 100;
     }

     windowStates[id] = {
       x, y: clampTitlebarY(y), width: w, height: h,
       isMaximized: win?.defaultMaximized || false,
       isMinimized: false,
       prev: null 
     };
  }
  return windowStates[id];
};

const isWindowActive = (id) => activeWindowId.value === id;

const handleFocus = (id) => {
  bringToFront(id);
};

const toggleMinimize = (id) => {
  const state = getWindowState(id);
  state.isMinimized = !state.isMinimized;
  if (state.isMinimized) {
    windowStore.minimizeWindow(id);
  } else {
    windowStore.restoreWindow(id);
  }
};

// Sync store state with local state
watch(
  () => activeWindows.value.map(w => ({ id: w.id, isMinimized: w.isMinimized })),
  (windows) => {
    windows.forEach(({ id, isMinimized }) => {
      const state = getWindowState(id);
      if (state.isMinimized !== isMinimized) {
        state.isMinimized = !!isMinimized;
      }
    });
  },
  { deep: true }
);

const toggleMaximize = (id) => {
  const win = activeWindows.value.find(w => w.id === id);
  if (win?.maximizable === false) return;

  const state = getWindowState(id);
  state.isMaximized = !state.isMaximized;
  
  if (state.isMaximized) {
    // Save previous state
    state.prev = { x: state.x, y: state.y, width: state.width, height: state.height };
    
    // Apply maximize dimensions
    const inset = dockInsets.value;
    const left = inset.left || 0;
    const right = inset.right || 0;
    const top = inset.top || 0;
    const bottom = inset.bottom || 0;
    state.x = EDGE_GAP_PX + left;
    state.y = EDGE_GAP_PX + top;
    state.width = Math.max(0, window.innerWidth - left - right - EDGE_GAP_PX * 2);
    state.height = Math.max(0, window.innerHeight - top - bottom - EDGE_GAP_PX * 2);
  } else if (state.prev) {
    // Restore
    state.x = state.prev.x;
    state.y = clampTitlebarY(state.prev.y);
    state.width = state.prev.width;
    state.height = state.prev.height;
  }
};

// --- Drag & Resize Logic (Simplified for brevity, assuming standard implementation) ---
// (Keeping existing logic structure but ensuring it uses windowStates)

const dragState = reactive({ isDragging: false, id: null, source: null, startX: 0, startY: 0, initialX: 0, initialY: 0, pendingUnmaximize: false });
const resizeState = reactive({ isResizing: false, id: null, startX: 0, startY: 0, initialW: 0, initialH: 0 });
const snapPreview = reactive({ visible: false, x: 0, y: 0, width: 0, height: 0 });

const canStartImmersiveDragFromEvent = (e) => {
  const isDragRegion = e.target.closest('[data-window-drag]');
  const isNoDrag = e.target.closest('.no-drag') ||
    ['BUTTON', 'INPUT', 'TEXTAREA', 'A', 'SELECT'].includes(e.target.tagName);
  return !!isDragRegion && !isNoDrag;
};

const handleWindowDblClick = (e, id) => {
  // Only handle immersive windows which rely on this logic
  // Standard windows use the titlebar dblclick handler directly
  const win = activeWindows.value.find(w => w.id === id);
  if (!win?.immersive) return;
  if (!canStartImmersiveDragFromEvent(e)) return;
  toggleMaximize(id);
};

// 已移除沙盒拖拽代理

const startDrag = (e, id) => {
  const win = activeWindows.value.find(w => w.id === id);
  if (!win) return;

  // Immersive: Drag only on specific regions
  if (win.immersive) {
    if (!canStartImmersiveDragFromEvent(e)) return;
  } else {
    // Non-Immersive: Drag only via Titlebar
    if (!e.target.closest('.window-titlebar')) return;
  }

  const state = getWindowState(id);
  handleFocus(id);
  dragState.isDragging = true;
  dragState.id = id;
  dragState.source = 'host';
  dragState.startX = e.clientX;
  dragState.startY = e.clientY;
  dragState.initialX = state.x;
  dragState.initialY = state.y;
  dragState.pendingUnmaximize = !!state.isMaximized;
  
  window.addEventListener('mousemove', onDrag);
  window.addEventListener('mouseup', stopDrag);
};

const onDrag = (e) => {
  if (!dragState.isDragging) return;
  const state = getWindowState(dragState.id);

  if (dragState.pendingUnmaximize && state.isMaximized) {
    const dx0 = e.clientX - dragState.startX;
    const dy0 = e.clientY - dragState.startY;
    const DRAG_THRESHOLD_PX = 4;
    if (Math.hypot(dx0, dy0) < DRAG_THRESHOLD_PX) return;

    state.isMaximized = false;

    const targetW = state.prev ? state.prev.width : 800;
    const targetH = state.prev ? state.prev.height : 600;

    const currentW = state.width;
    const offsetX = e.clientX - state.x;
    const ratio = currentW > 0 ? (offsetX / currentW) : 0.5;

    state.width = targetW;
    state.height = targetH;
    state.x = e.clientX - (targetW * ratio);
    state.y = clampTitlebarY(e.clientY - 15);
    state.prev = null;

    dragState.startX = e.clientX;
    dragState.startY = e.clientY;
    dragState.initialX = state.x;
    dragState.initialY = state.y;
    dragState.pendingUnmaximize = false;
    return;
  }

  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;
  
  state.x = dragState.initialX + dx;
  state.y = clampTitlebarY(dragState.initialY + dy);
  
  // Snap Logic
  const SNAP_MARGIN = 10;
  const mouseX = e.clientX;
  const mouseY = e.clientY;
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;
  const inset = dockInsets.value;
  const leftInset = inset.left || 0;
  const rightInset = inset.right || 0;
  const topInset = inset.top || 0;
  const bottomInset = inset.bottom || 0;
  const availableX = EDGE_GAP_PX + leftInset;
  const availableY = EDGE_GAP_PX + topInset;
  const availableW = Math.max(0, screenW - leftInset - rightInset - EDGE_GAP_PX * 2);
  const availableH = Math.max(0, screenH - topInset - bottomInset - EDGE_GAP_PX * 2);

  snapPreview.visible = false;
  snapPreview.action = null;

  // Top -> Maximize
  if (mouseY < topInset + SNAP_MARGIN) {
      snapPreview.visible = true;
      snapPreview.x = availableX;
      snapPreview.y = availableY;
      snapPreview.width = availableW;
      snapPreview.height = availableH;
      snapPreview.action = 'maximize';
  }
  // Left -> Left Half
  else if (mouseX < leftInset + SNAP_MARGIN) {
      snapPreview.visible = true;
      snapPreview.x = availableX;
      snapPreview.y = availableY;
      snapPreview.width = Math.max(0, availableW / 2 - EDGE_GAP_PX * 0.5);
      snapPreview.height = availableH;
      snapPreview.action = 'left';
  }
  // Right -> Right Half
  else if (mouseX > screenW - rightInset - SNAP_MARGIN) {
      snapPreview.visible = true;
      snapPreview.x = availableX + availableW / 2 + EDGE_GAP_PX * 0.5;
      snapPreview.y = availableY;
      snapPreview.width = Math.max(0, availableW / 2 - EDGE_GAP_PX * 0.5);
      snapPreview.height = availableH;
      snapPreview.action = 'right';
  }
};

const stopDrag = () => {
  if (dragState.isDragging && snapPreview.visible && dragState.id) {
      const id = dragState.id;
      const state = getWindowState(id);
      
      if (snapPreview.action === 'maximize') {
          if (!state.isMaximized) toggleMaximize(id);
      } else {
          // Split screen
          state.isMaximized = false;
          state.x = snapPreview.x;
          state.y = snapPreview.y;
          state.width = snapPreview.width;
          state.height = snapPreview.height;
          // Clear prev state to prevent "restore" jumping back to old pos if maximized later
          state.prev = null;
      }
  }

  snapPreview.visible = false;
  dragState.isDragging = false;
  dragState.id = null;
  dragState.source = null;
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDrag);
};

const startResize = (e, id) => {
  handleFocus(id);
  resizeState.isResizing = true;
  resizeState.id = id;
  resizeState.startX = e.clientX;
  resizeState.startY = e.clientY;
  resizeState.initialW = getWindowState(id).width;
  resizeState.initialH = getWindowState(id).height;
  
  window.addEventListener('mousemove', onResize);
  window.addEventListener('mouseup', stopResize);
};

const onResize = (e) => {
  if (!resizeState.isResizing) return;
  const dx = e.clientX - resizeState.startX;
  const dy = e.clientY - resizeState.startY;
  const state = getWindowState(resizeState.id);
  
  state.width = Math.max(200, resizeState.initialW + dx);
  state.height = Math.max(100, resizeState.initialH + dy);
};

const stopResize = () => {
  resizeState.isResizing = false;
  resizeState.id = null;
  window.removeEventListener('mousemove', onResize);
  window.removeEventListener('mouseup', stopResize);
};

// Sync watcher for cleanup
watch(activeWindows, (newWindows) => {
  const currentIds = new Set(newWindows.map(w => w.id));
  Object.keys(windowStates).forEach(id => {
    if (!currentIds.has(id)) { // Use string/number consistency check if needed
       // Check type consistency: id in windowStates is likely string key
       if (!currentIds.has(Number(id)) && !currentIds.has(String(id))) {
         delete windowStates[id];
       }
    }
  });
}, { deep: true });

onMounted(() => {
  window.addEventListener('resize', applyDockOffset);
  // Initial dock check
  setTimeout(applyDockOffset, 500);
});

onUnmounted(() => {
  window.removeEventListener('resize', applyDockOffset);
});
</script>
