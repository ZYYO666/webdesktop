<template>
  <div 
    class="h-full w-full relative overflow-hidden select-none overscroll-none bg-black"
    @mousedown.self="handleDesktopBackgroundDown"
    @contextmenu.prevent="handleContextMenu"
    ref="containerRef"
  >
    <template v-if="currentWallpaperKind === 'video' && wallpaperVideoUrl">
      <video
        class="absolute inset-0 w-full h-full object-cover transition-none"
        :src="wallpaperVideoUrl"
        autoplay
        loop
        muted
        playsinline
      ></video>
    </template>
    <template v-else>
      <div
        class="absolute inset-0 bg-cover bg-center transition-none"
        :class="wallpaperLayer === 'a' ? 'opacity-100' : 'opacity-0'"
        :style="{ backgroundImage: `url('${wallpaperA}')` }"
      ></div>
      <div
        class="absolute inset-0 bg-cover bg-center transition-none"
        :class="wallpaperLayer === 'b' ? 'opacity-100' : 'opacity-0'"
        :style="{ backgroundImage: `url('${wallpaperB}')` }"
      ></div>
    </template>
    <div class="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/5 via-black/0 to-black/30"></div>

    <!-- Desktop Icons Grid -->
    <div 
      class="absolute inset-0 z-10 pointer-events-auto pl-6 pr-6 pt-6 pb-[108px]"
    >
      <div
        ref="desktopGridRef"
        class="relative w-full h-full overflow-hidden"
        @mousedown.self="handleDesktopBackgroundDown"
        @dragover.prevent="handleDragOver"
        @drop="handleDrop"
      >
        <template v-if="showDesktopIcons">
          <div
            v-for="item in desktopItems"
            :key="item.id"
            class="absolute flex items-center justify-center transition-none"
            :class="{ 'opacity-0 pointer-events-none': shouldHideDesktopItem(item) }"
            :style="getDesktopItemStyle(item)"
            @dragover.prevent="handleDragOver"
          >
            <div
              :class="['flex flex-col items-center justify-start p-2.5 w-[102px] h-[112px] rounded-[20px] border border-transparent hover:bg-white/12 hover:border-white/35 cursor-default select-none group relative transition-all duration-150', selectedIds.has(item.id) ? 'ring-2 ring-blue-500/35 bg-blue-500/12 border-blue-300/30 shadow-sm shadow-blue-500/20' : '', isCut && selectedIds.has(item.id) ? 'opacity-50' : '']"
              @click="selectItem(item, $event)"
              @dblclick="openItem(item)"
              @contextmenu.stop="toggleMenu(item, $event)"
              @dragstart="handleDragStart(item, $event)"
              @dragend="handleDragEnd"
              @drop="handleDropOnFolder(item, $event)"
              :draggable="renamingId !== item.id"
              :data-id="item.id"
              class="desktop-icon-item pointer-events-auto"
            >
              <div class="mb-1 pointer-events-none relative flex justify-center items-end h-[58px] w-full">
                <div class="w-[52px] h-[52px] flex items-center justify-center relative drop-shadow-[0_10px_20px_rgba(0,0,0,0.28)]">
                  <template v-if="item.iconImage">
                    <img :src="item.iconImage" class="w-full h-full object-cover rounded-[18px]" :alt="item.label" loading="lazy" />
                  </template>
                  <template v-else-if="item.file">
                    <div
                      v-if="iconFor(item.file)?.kind === 'svg'"
                      class="w-full h-full flex items-center justify-center rounded-[18px]"
                      :class="iconFor(item.file)?.bgClass || ''"
                    >
                      <component :is="iconFor(item.file)?.icon || FileIcon" :size="26" stroke-width="1.8" :class="iconFor(item.file)?.fgClass || ''" />
                    </div>
                    <img
                      v-else
                      :src="iconFor(item.file)?.src"
                      class="w-full h-full object-cover rounded-[18px]"
                      :alt="item.label"
                      loading="lazy"
                    />
                  </template>
                  <template v-else>
                    <div class="w-full h-full flex items-center justify-center rounded-[18px] bg-slate-100">
                      <FileIcon :size="26" stroke-width="1.8" class="text-slate-700" />
                    </div>
                  </template>
                </div>
              </div>
              <div class="w-[86px] -mx-[22px] px-1">
                <input
                  v-if="renamingId === item.id"
                  ref="renameInputRef"
                  v-model="renameDraft"
                  class="w-full text-xs leading-tight text-center font-medium px-1.5 py-1 rounded-md outline-none select-text text-white bg-black/40 border border-white/30"
                  @click.stop
                  @mousedown.stop
                  @keydown.enter.prevent="commitRename(item.id, renameDraft)"
                  @keydown.esc.prevent="cancelRename"
                  @blur="commitRename(item.id, renameDraft)"
                />
                <span
                  v-else
                  class="text-[11px] leading-tight text-center break-all w-full h-[34px] overflow-hidden font-medium px-2 py-0.5 text-white rounded-full bg-black/30 backdrop-blur-md [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]"
                  style="text-shadow: 0 1px 3px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.5);"
                  :title="item.label"
                >
                  {{ item.label }}
                </span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Selection Box -->
    <div
      v-if="showDesktopIcons && selectionBox.visible"
      class="absolute bg-blue-500/15 border-2 border-blue-500/90 shadow-[0_0_0_1px_rgba(255,255,255,0.25)] rounded-sm z-20 pointer-events-none transition-none"
      :style="{
        left: 0,
        top: 0,
        transform: `translate3d(${selectionBox.x}px, ${selectionBox.y}px, 0)`,
        width: selectionBox.w + 'px',
        height: selectionBox.h + 'px'
      }"
    ></div>

    <Dock v-if="showDock" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { File as FileIcon } from 'lucide-vue-next';
import { getDragFiles, getDragPayload, isDirectoryFile, setDragPayload, useOs } from '@/os';
import Dock from './components/Dock.vue';
import { useDesktopUiVisibility } from './composables/useDesktopUiVisibility';
import { useWallpaper } from './composables/useWallpaper';
import { useDesktopLayout } from './composables/useDesktopLayout';
import { useDesktopDragSession } from './composables/useDesktopDragSession';
import { useDesktopDragDrop } from './composables/useDesktopDragDrop';
import { buildDesktopContextMenuOptions, createDesktopContextMenuHandlers } from './services/desktopContextMenu';

const os = useOs();
const api = os.api;

// Use runtime for APIs and UI
const openWindow = os.stores.windows.openWindow;
const openFile = os.stores.windows.openFile;
const { toast } = os.ui;
const APPS = os.apps;

const { clipboard, refreshTrigger } = os.files.useRefs();
const triggerGlobalRefresh = os.files.triggerRefresh;

const iconFor = (file) => os.files.getIcon(file);

const currentWallpaperUrl = computed(() => os.stores.system.currentWallpaperUrl);
const currentWallpaperKind = computed(() => os.stores.system.currentWallpaperKind);

const { showDesktopIcons, showDock, loadDesktopUiVisibility } = useDesktopUiVisibility();
const { wallpaperA, wallpaperB, wallpaperLayer, wallpaperVideoUrl } = useWallpaper({ currentWallpaperUrl, currentWallpaperKind });

const cleanScreenSnapshot = ref(null);
const cleanScreenActive = computed(() => !!cleanScreenSnapshot.value);

const cleanScreen = () => {
  if (cleanScreenSnapshot.value) {
    const snapshot = cleanScreenSnapshot.value;
    cleanScreenSnapshot.value = null;
    showDesktopIcons.value = !!snapshot.icons;
    showDock.value = !!snapshot.dock;
    clearSelection();
    os.ui.contextMenu.close();
    return;
  }

  cleanScreenSnapshot.value = {
    icons: !!showDesktopIcons.value,
    dock: !!showDock.value,
  };

  showDesktopIcons.value = false;
  showDock.value = false;
  clearSelection();
  os.ui.contextMenu.close();
};

// Fetch desktop items
const fetchDesktopItems = async () => {
  try {
    const files = await api.getList('/desktop');
    if (Array.isArray(files)) {
      desktopItems.value = files.map(file => ({
        id: `file-${file.path}`,
        type: 'file',
        file: file,
        label: file.name,
        data: file
      }));
      await nextTick();
      updateGridMetrics();
      fillMissingDesktopIconLayouts({ persist: true });
    }
  } catch (err) {
    // Desktop folder not found or empty
    try {
      await os.files.createOps().dir.mkdir({ dirPath: '/', name: 'desktop', refresh: false });
      await fetchDesktopItems();
    } catch (e) {
      toast.error(e?.message || '无法创建桌面目录');
    }
  }
};

// Watch for global refresh trigger
watch(refreshTrigger, () => {
  fetchDesktopItems();
});

const createSelection = (options = {}) => {
  const {
    containerRef,
    itemSelector = '[data-id]',
    keyAttribute = 'data-id',
    scrollRef = null,
    onSelectionChange = null,
  } = options;

  const selectedKeys = ref(new Set());
  const isSelecting = ref(false);
  const selectionBox = reactive({
    visible: false,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    startX: 0,
    startY: 0,
  });

  let selectionStartKeys = new Set();
  let itemCache = [];
  let rootRect = null;
  let rafId = 0;
  let lastMousePos = { x: 0, y: 0 };

  const getScroll = () => {
    const el = scrollRef?.value || containerRef?.value;
    return {
      left: el ? el.scrollLeft : 0,
      top: el ? el.scrollTop : 0,
    };
  };

  const rebuildCache = () => {
    const el = containerRef.value;
    if (!el) return;

    rootRect = el.getBoundingClientRect();
    const items = el.querySelectorAll(itemSelector);
    const { left: scrollLeft, top: scrollTop } = getScroll();

    itemCache = Array.from(items).map((item) => {
      const rect = item.getBoundingClientRect();
      const key = item.getAttribute(keyAttribute);

      return {
        key,
        left: rect.left - rootRect.left + scrollLeft,
        top: rect.top - rootRect.top + scrollTop,
        right: rect.right - rootRect.left + scrollLeft,
        bottom: rect.bottom - rootRect.top + scrollTop,
      };
    });
  };

  const updateSelection = () => {
    if (!rootRect) return;

    const boxLeft = selectionBox.x;
    const boxTop = selectionBox.y;
    const boxRight = selectionBox.x + selectionBox.w;
    const boxBottom = selectionBox.y + selectionBox.h;

    const nextSelection = new Set(selectionStartKeys);

    itemCache.forEach((item) => {
      const intersects = !(
        boxLeft > item.right ||
        boxRight < item.left ||
        boxTop > item.bottom ||
        boxBottom < item.top
      );

      if (intersects) nextSelection.add(item.key);
      else if (!selectionStartKeys.has(item.key)) nextSelection.delete(item.key);
    });

    selectedKeys.value = nextSelection;
    if (onSelectionChange) onSelectionChange(nextSelection);
  };

  const handleMouseMove = (e) => {
    if (!isSelecting.value) return;

    lastMousePos.x = e.clientX;
    lastMousePos.y = e.clientY;

    if (rafId) return;

    rafId = requestAnimationFrame(() => {
      rafId = 0;
      if (!isSelecting.value || !rootRect) return;

      const { left: scrollLeft, top: scrollTop } = getScroll();

      const currentX = lastMousePos.x - rootRect.left + scrollLeft;
      const currentY = lastMousePos.y - rootRect.top + scrollTop;

      selectionBox.x = Math.min(currentX, selectionBox.startX);
      selectionBox.y = Math.min(currentY, selectionBox.startY);
      selectionBox.w = Math.abs(currentX - selectionBox.startX);
      selectionBox.h = Math.abs(currentY - selectionBox.startY);

      updateSelection();
    });
  };

  const handleMouseUp = () => {
    isSelecting.value = false;
    selectionBox.visible = false;
    itemCache = [];
    rootRect = null;

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }

    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };

  const startSelection = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest(itemSelector)) return;

    if (!e.ctrlKey && !e.metaKey) selectedKeys.value.clear();
    selectionStartKeys = new Set(selectedKeys.value);

    const el = containerRef.value;
    if (!el) return;

    rebuildCache();

    const { left: scrollLeft, top: scrollTop } = getScroll();
    selectionBox.startX = e.clientX - rootRect.left + scrollLeft;
    selectionBox.startY = e.clientY - rootRect.top + scrollTop;

    selectionBox.x = selectionBox.startX;
    selectionBox.y = selectionBox.startY;
    selectionBox.w = 0;
    selectionBox.h = 0;
    selectionBox.visible = true;
    isSelecting.value = true;

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const toggleSelection = (key, multi = false) => {
    const next = new Set(multi ? selectedKeys.value : []);
    if (multi) {
      if (next.has(key)) next.delete(key);
      else next.add(key);
    } else {
      next.add(key);
    }
    selectedKeys.value = next;
    if (onSelectionChange) onSelectionChange(next);
  };

  const clearSelection = () => {
    selectedKeys.value.clear();
    if (onSelectionChange) onSelectionChange(selectedKeys.value);
  };

  onUnmounted(() => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
    if (rafId) cancelAnimationFrame(rafId);
  });

  return {
    selectedKeys,
    selectionBox,
    isSelecting,
    startSelection,
    toggleSelection,
    clearSelection,
  };
};

// Data State
const desktopItems = ref([]);
const containerRef = ref(null);
const desktopGridRef = ref(null);

const {
  desktopLayout,
  getLayoutKey,
  getDesktopItemStyle,
  saveDesktopLayout,
  fillMissingDesktopIconLayouts,
  updateGridMetrics,
  resetDesktopLayout: resetDesktopLayoutState,
  computeGridDropIndex,
  cellFromIdxOrNull,
  canPlaceIconPathsAtIndex,
} = useDesktopLayout({ desktopItems, desktopGridRef });

const { 
  selectedKeys: selectedIds,
  selectionBox,
  startSelection,
  toggleSelection,
  clearSelection
} = createSelection({
  containerRef,
  itemSelector: '.desktop-icon-item',
  keyAttribute: 'data-id'
});

const desktopPathRef = ref('/desktop');

const fileOps = os.files.createOps({ currentPath: desktopPathRef, refresh: fetchDesktopItems });

const handleRenameFromMenu = (file) => {
  const item = desktopItems.value.find(i => i.file?.path === file.path);
  if (item) renamingId.value = item.id;
};

const handleOpenFromMenu = (file) => {
  if (file.type === 'app') {
    openWindow(file);
  } else {
    openFile(file);
  }
};

const isCut = ref(false);
const currentSelection = ref([]);
const renamingId = ref(null);
const renameSubmitting = ref(false);
const renameDraft = ref('');
const renameInputRef = ref(null);

const focusRenameInput = async () => {
  await nextTick();
  const el = renameInputRef.value;
  if (!el) return;
  try {
    el.focus();
    el.select?.();
  } catch (e) {
    void e;
  }
};

watch(renamingId, (val) => {
  if (!val) return;
  const item = desktopItems.value.find((i) => i.id === val);
  renameDraft.value = item?.label || item?.file?.name || '';
  focusRenameInput();
});

const { dragSession, ensureDragSession, clearDragSession, setCustomDragImageFromEl, shouldHideDesktopItem } = useDesktopDragSession({ desktopLayout, getLayoutKey });

const { handleDragStart, handleDragEnd, handleDragOver, handleDrop, handleDropOnFolder } = useDesktopDragDrop({
  desktopItems,
  selectedIds,
  desktopLayout,
  saveDesktopLayout,
  fetchDesktopItems,
  fileOps,
  toast,
  triggerGlobalRefresh,
  ensureDragSession,
  clearDragSession,
  dragSession,
  setCustomDragImageFromEl,
  computeGridDropIndex,
  canPlaceIconPathsAtIndex,
  cellFromIdxOrNull,
  getDragPayload,
  getDragFiles,
  setDragPayload,
  isDirectoryFile,
  defaultDesktopDir: '/desktop',
});


const handleDesktopBackgroundDown = (e) => {
  if (!showDesktopIcons.value) return;
  startSelection(e);
};

onMounted(() => {
  loadDesktopUiVisibility();

  fetchDesktopItems();

  document.addEventListener('click', () => {
    os.ui.contextMenu.close();
  });

  document.addEventListener('dragend', handleDragEnd);
  document.addEventListener('drop', () => clearDragSession({ restore: false }));
});

const selectItem = (item, event) => {
  if (event.ctrlKey || event.metaKey) {
    toggleSelection(item.id, true);
  } else {
    clearSelection();
    toggleSelection(item.id, false);
  }
};

const openItem = (item) => {
  if (item.type === 'app') {
    openWindow({
      ...item.data,
    });
  } else if (item.type === 'file') {
    openFile(item.file);
  }
};

const cancelRename = () => {
  renamingId.value = null;
};

const commitRename = async (id, nextName) => {
  if (renameSubmitting.value) return;
  const item = desktopItems.value.find((i) => i.id === id);
  if (!item?.file?.path) { cancelRename(); return; }
  const name = String(nextName || '').trim();
  if (!name || name === item.file.name) { cancelRename(); return; }
  renameSubmitting.value = true;
  try {
    await fileOps.fs.rename({ path: item.file.path, newName: name, refresh: false });
    renamingId.value = null;
    await fetchDesktopItems();
  } catch (e) {
    toast.error(e.message);
  } finally {
    renameSubmitting.value = false;
  }
};

const createFolderAndRename = async () => {
  const baseName = '新建文件夹';
  try {
    const prevPaths = new Set(
      (desktopItems.value || [])
        .map((i) => i?.file?.path)
        .filter(Boolean)
    );

    const res = await fileOps.dir.mkdir({ dirPath: '/desktop', name: baseName, refresh: fetchDesktopItems });
    if (!res.ok) return;

    const createdDir = (desktopItems.value || []).find((i) => {
      if (i?.type !== 'file' || !i?.file?.path) return false;
      if (!isDirectoryFile(i.file)) return false;
      return !prevPaths.has(i.file.path);
    });

    if (createdDir?.file?.path) {
      renamingId.value = `file-${createdDir.file.path}`;
    }
  } catch (e) {
    toast.error(e.message);
  }
};

const resetDesktopLayout = () => {
  resetDesktopLayoutState();
  toast.success('桌面布局已重置');
};

const contextMenuHandlers = createDesktopContextMenuHandlers({
  toast,
  apps: APPS,
  openWindow,
  fileOps,
  fetchDesktopItems,
  cleanScreen,
  createFolderAndRename,
  resetDesktopLayout,
  handleOpenFromMenu,
  handleRenameFromMenu,
  defaultDesktopPath: '/desktop',
});

const toggleMenu = (item, e) => {
  e.stopPropagation();
  e.preventDefault();
  
  if (!selectedIds.value.has(item.id)) {
    selectedIds.value.clear();
    selectedIds.value.add(item.id);
  }

  if (selectedIds.value.size > 1 && selectedIds.value.has(item.id)) {
    currentSelection.value = desktopItems.value
      .filter(i => selectedIds.value.has(i.id) && i.type === 'file')
      .map(i => i.file);
  } else {
    currentSelection.value = item.type === 'file' ? [item.file] : [];
  }

  const file = item.type === 'app'
    ? { ...item.data, type: 'app', id: item.id }
    : { ...item.file, id: item.id };

  let position = null;
  if (Number.isFinite(e?.clientX) && Number.isFinite(e?.clientY)) {
    position = { top: e.clientY, left: e.clientX };
  } else {
    const rect = e.currentTarget?.getBoundingClientRect?.();
    if (rect) position = { top: rect.bottom + 4, left: rect.left };
  }

  os.ui.contextMenu.open({
    event: e,
    position,
    file,
    files: currentSelection.value,
    clipboard,
    options: buildDesktopContextMenuOptions({ file, files: currentSelection.value, clipboard, cleanScreenActive }),
    currentPath: desktopPathRef,
    refresh: fetchDesktopItems,
    showSort: false,
    showSettings: true,
    handlers: contextMenuHandlers
  });
};

const handleContextMenu = (e) => {
  currentSelection.value = [];
  os.ui.contextMenu.open({
    event: e,
    file: null,
    files: [],
    clipboard,
    options: buildDesktopContextMenuOptions({ file: null, files: [], clipboard, cleanScreenActive }),
    currentPath: desktopPathRef,
    refresh: fetchDesktopItems,
    showSort: false,
    showSettings: true,
    handlers: contextMenuHandlers
  });
};
</script>
