<template>
  <div ref="rootRef" class="h-full flex flex-col relative bg-white">
    <n-layout has-sider class="h-full w-full bg-transparent">
      <n-layout-sider
        collapse-mode="transform"
        :collapsed-width="0"
        :collapsed="!isSidebarVisible"
        :width="220"
        :native-scrollbar="false"
        class="bg-gray-50 h-full border-r border-gray-100"
      >
        <div class="h-full flex flex-col">
          <div class="shrink-0" style="height: var(--immersive-safe-top, 48px)" data-window-drag></div>
          <AppFileBrowserSidebar 
            :current-path="currentPath"
            :visible="isSidebarVisible"
            @navigate="navigateTo"
          />
        </div>
      </n-layout-sider>

      <div class="flex-1 min-w-0 h-full flex flex-col bg-transparent">
        <div class="shrink-0 h-12">
          <AppFileBrowserTopBar 
            :can-go-back="historyIndex > 0"
            :can-go-forward="historyIndex < history.length - 1"
            :loading='loading'
            :title="headerTitle"
            :search-query="searchQuery"
            :view-mode="viewMode"
            :file-type-filter="fileTypeFilter"
            :is-uploading="isUploading"
            :upload-progress="uploadProgress"
            :window-width="windowWidth"
            @toggle-sidebar="handleToggleSidebar"
            @back="goBack"
            @forward="goForward"
            @refresh='refresh'
            @create-folder="createFolderAndRename"
            @trigger-upload="triggerUpload"
            @update:searchQuery="searchQuery = $event"
            @update:viewMode="viewMode = $event"
            @update:fileTypeFilter="fileTypeFilter = $event"
          />
        </div>

        <div class="flex-1 min-h-0">
          <div
            class="h-full overflow-y-auto p-4 relative select-none"
            @contextmenu.prevent="handleContextMenu"
            @mousedown.capture="startSelection"
            @dragover.prevent="handleExternalDragOver"
            @dragleave="handleExternalDragLeave"
            @drop.prevent="handleExternalDrop"
            ref="containerRef"
          >
            <div v-if="loading || isSearching" class="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm z-40 transition-all duration-300">
              <n-spin size="large">
                <template #description v-if="isSearching">
                   Searching...
                </template>
              </n-spin>
            </div>

            <div
              v-if="selectionBox.visible"
              class="absolute bg-blue-500/15 border-2 border-blue-500/90 shadow-[0_0_0_1px_rgba(255,255,255,0.25)] rounded-sm z-30 pointer-events-none transition-none"
              :style="{
                left: 0,
                top: 0,
                transform: `translate3d(${selectionBox.x}px, ${selectionBox.y}px, 0)`,
                width: selectionBox.w + 'px',
                height: selectionBox.h + 'px'
              }"
            ></div>

            <div v-if="filteredItems.length === 0 && !loading" class="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
              <n-empty :description="'未找到项目'">
                <template #icon>
                  <n-icon :size="48" class="text-gray-300">
                    <ImageOff />
                  </n-icon>
                </template>
              </n-empty>
            </div>
          
            <template v-else>
              <!-- List View (Default - All files together) -->
              <div v-if="viewMode === 'list' || viewMode === 'grid'" class="pb-20">
                <div class="grid justify-items-center" :style="itemGridStyle">
                  <div
                    v-for="file in filteredItems" 
                    :key="file.path" 
                    :data-path="file.path"
                    class="flex flex-col items-center justify-start p-2 w-[96px] h-[108px] rounded-xl border border-transparent hover:bg-blue-500/10 hover:border-blue-400/30 cursor-default select-none group relative transition-all duration-200"
                    :class="{
                      'ring-2 ring-blue-500/50 bg-blue-500/10 border-blue-400/20': selectedFiles.has(file.path),
                      'ring-2 ring-blue-500/30 bg-blue-500/10': dragOverPath === file.path && file.type === 'directory'
                    }"
                    @click.stop="handleSingleClick(file, $event)"
                    @dblclick.stop="handleDoubleClick(file)"
                    @contextmenu.prevent.stop="(e) => toggleMenu(file, e)"
                    :draggable="renamingPath !== file.path"
                    @dragstart="(e) => handleDragStart(file, e)"
                    @dragover.prevent="(e) => handleItemDragOver(file, e)"
                    @dragleave="() => handleItemDragLeave(file)"
                    @drop.prevent="(e) => handleItemDrop(file, e)"
                  >
                    <div class="mb-1.5 pointer-events-none relative flex justify-center items-end h-[52px] w-full transition-transform duration-200 group-hover:scale-105">
                      <div class="w-[48px] h-[48px] flex items-center justify-center relative">
                        <div
                          v-if="iconFor(file)?.kind === 'svg'"
                          class="w-full h-full flex items-center justify-center rounded-xl"
                          :class="iconFor(file)?.bgClass || ''"
                        >
                          <component :is="iconFor(file)?.icon" :size="24" stroke-width="1.8" :class="iconFor(file)?.fgClass || ''" />
                        </div>
                        <img
                          v-else
                          :src="iconSrcFor(file)"
                          class="w-full h-full object-cover rounded-xl transition-transform duration-200"
                          :alt="fileLabel(file)"
                          loading="lazy"
                        />
                        <div v-if="showVideoBadge(file)" class="absolute bottom-1 right-1 pointer-events-none">
                          <div class="w-[18px] h-[18px] rounded-full bg-black/35 backdrop-blur-sm flex items-center justify-center">
                            <Play class="text-white/90" :size="10" stroke-width="2.5" />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="w-[80px] -mx-[22px] px-1">
                      <input
                        v-if="renamingPath === file.path"
                        ref="renameInputRef"
                        v-model="renameDraft"
                        class="w-full text-xs leading-tight text-center font-medium px-1.5 py-1 rounded-md outline-none select-text text-black bg-white border border-black/10"
                        @click.stop
                        @mousedown.stop
                        @keydown.enter.prevent="commitRenameFromDraft(file)"
                        @keydown.esc.prevent="cancelRename"
                        @blur="commitRenameFromDraft(file)"
                      />
                      <span
                        v-else
                        class="text-xs leading-tight text-center break-all w-full h-[34px] overflow-hidden font-medium px-1.5 py-0.5 [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] text-black"
                        :title="fileLabel(file)"
                      >
                        {{ fileLabel(file) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Timeline View -->
              <div v-else-if="viewMode === 'timeline'" class="pb-20 space-y-8">
                <div v-for="(group, date) in timelineGroups" :key='date'>
                  <div class="sticky top-0 bg-white/95 backdrop-blur-sm z-10 py-3 mb-2 border-b border-gray-50 flex items-center gap-2">
                     <h3 class="text-sm font-bold text-gray-800">{{ date }}</h3>
                     <span class="text-xs font-medium text-gray-400 px-2 py-0.5 bg-gray-100 rounded-full">{{ group.length }} items</span>
                  </div>
                  
                  <div class="grid justify-items-center" :style="itemGridStyle">
                    <div
                      v-for="file in group" 
                      :key="file.path" 
                      :data-path="file.path"
                      class="flex flex-col items-center justify-start p-2 w-[96px] h-[108px] rounded-xl border border-transparent hover:bg-blue-500/10 hover:border-blue-400/30 cursor-default select-none group relative transition-all duration-200"
                      :class="{
                        'ring-2 ring-blue-500/50 bg-blue-500/10 border-blue-400/20': selectedFiles.has(file.path),
                        'ring-2 ring-blue-500/30 bg-blue-500/10': dragOverPath === file.path && file.type === 'directory'
                      }"
                      @click.stop="handleSingleClick(file, $event)"
                      @dblclick.stop="handleDoubleClick(file)"
                      @contextmenu.prevent.stop="(e) => toggleMenu(file, e)"
                      :draggable="renamingPath !== file.path"
                      @dragstart="(e) => handleDragStart(file, e)"
                      @dragover.prevent="(e) => handleItemDragOver(file, e)"
                      @dragleave="() => handleItemDragLeave(file)"
                      @drop.prevent="(e) => handleItemDrop(file, e)"
                    >
                      <div class="mb-1.5 pointer-events-none relative flex justify-center items-end h-[52px] w-full transition-transform duration-200 group-hover:scale-105">
                        <div class="w-[48px] h-[48px] flex items-center justify-center relative">
                          <div
                            v-if="iconFor(file)?.kind === 'svg'"
                            class="w-full h-full flex items-center justify-center rounded-xl"
                            :class="iconFor(file)?.bgClass || ''"
                          >
                            <component :is="iconFor(file)?.icon" :size="24" stroke-width="1.8" :class="iconFor(file)?.fgClass || ''" />
                          </div>
                          <img
                            v-else
                            :src="iconSrcFor(file)"
                            class="w-full h-full object-cover rounded-xl transition-transform duration-200"
                            :alt="fileLabel(file)"
                            loading="lazy"
                          />
                          <div v-if="showVideoBadge(file)" class="absolute bottom-1 right-1 pointer-events-none">
                            <div class="w-[18px] h-[18px] rounded-full bg-black/35 backdrop-blur-sm flex items-center justify-center">
                              <Play class="text-white/90" :size="10" stroke-width="2.5" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div class="w-[80px] -mx-[22px] px-1">
                        <input
                          v-if="renamingPath === file.path"
                          ref="renameInputRef"
                          v-model="renameDraft"
                          class="w-full text-xs leading-tight text-center font-medium px-1.5 py-1 rounded-md outline-none select-text text-black bg-white border border-black/10"
                          @click.stop
                          @mousedown.stop
                          @keydown.enter.prevent="commitRenameFromDraft(file)"
                          @keydown.esc.prevent="cancelRename"
                          @blur="commitRenameFromDraft(file)"
                        />
                        <span
                          v-else
                          class="text-xs leading-tight text-center break-all w-full h-[34px] overflow-hidden font-medium px-1.5 py-0.5 [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] text-black"
                          :title="fileLabel(file)"
                        >
                          {{ fileLabel(file) }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Media View -->
              <div v-else-if="viewMode === 'media'">
                <div
                  v-if="mediaItems.length > 0"
                  class="gap-3 space-y-3 pb-24 px-2"
                  :style="mediaColumnsStyle"
                >
                  <div 
                    v-for="file in mediaItems" 
                    :key="file.path" 
                    :data-path="file.path"
                    class="break-inside-avoid mb-3 relative group rounded-2xl overflow-hidden cursor-pointer bg-gray-100 border-2 transition-[border-color,transform] duration-300 ease-out"
                    :class="highlightedItem === file.path ? 'border-blue-500' : 'border-transparent'"
                    @click.stop="handleSingleClick(file, $event)"
                    @dblclick="handleDoubleClick(file)"
                    @contextmenu.prevent.stop="(e) => toggleMenu(file, e)"
                  >
                    <img 
                      v-lazy="getMediaThumbSrc(file)"
                      :alt="file.name"
                      class="w-full h-auto object-cover transform transition-transform duration-500 ease-out group-hover:scale-105"
                    />
                    
                    <div
                      v-if="isVideoFile(file)"
                      class="absolute inset-0 flex items-center justify-center pointer-events-none"
                    >
                      <div class="w-11 h-11 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center">
                        <Play class="text-white" :size="20" stroke-width="2.5" />
                      </div>
                    </div>

                    <button 
                      @click.stop="handleToggleSelection(file)" 
                      class="absolute top-2 left-2 w-5 h-5 rounded-md flex items-center justify-center transition-[opacity,transform,background-color] z-20"
                      :class="selectedFiles.has(file.path) ? 'bg-blue-500 text-white shadow-sm opacity-100 scale-100' : 'bg-white/80 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-white scale-90 hover:scale-100'"
                    >
                      <Check v-if="selectedFiles.has(file.path)" :size="12" stroke-width="3" />
                      <div v-else class="w-3 h-3 rounded-sm border-2 border-current"></div>
                    </button>
                    <div v-if="file.isFavorite" class="absolute top-2 right-2 p-1.5 text-yellow-500 bg-white/90 rounded-full z-10 shadow-sm pointer-events-none">
                      <Star :size="14" class="fill-yellow-500" />
                    </div>
                    
                    <div class="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                      <p class="text-white text-sm font-medium truncate">{{ file.name }}</p>
                      <p class="text-white/70 text-xs mt-0.5">{{ formatSize(file.size) }}</p>
                    </div>
                  </div>
                </div>
                <div v-else class="flex flex-col items-center justify-center h-full text-gray-400 py-20">
                  <n-empty :description="'未找到媒体'">
                    <template #icon>
                      <n-icon :size="48" class="text-gray-300">
                        <ImageOff />
                      </n-icon>
                    </template>
                  </n-empty>
                </div>
              </div>

              <!-- Grid View (Categorized) -->
              <div v-else class="pb-20 space-y-8">
                <div v-for="category in categories" :key="category.type">
                  <div v-if="category.items.length > 0">
                    <div class="sticky top-0 bg-white/95 backdrop-blur-sm z-10 py-3 mb-2 border-b border-gray-50 flex items-center gap-2">
                       <h3 class="text-sm font-bold text-gray-800">{{ category.title }}</h3>
                       <span class="text-xs font-medium text-gray-400 px-2 py-0.5 bg-gray-100 rounded-full">{{ category.items.length }} items</span>
                    </div>
                    
                    <div class="grid justify-items-center" :style="itemGridStyle">
                      <div
                        v-for="file in category.items" 
                        :key="file.path" 
                        :data-path="file.path"
                        class="flex flex-col items-center justify-start p-2 w-[96px] h-[108px] rounded-xl border border-transparent hover:bg-blue-500/10 hover:border-blue-400/30 cursor-default select-none group relative transition-all duration-200"
                        :class="{
                          'ring-2 ring-blue-500/50 bg-blue-500/10 border-blue-400/20': selectedFiles.has(file.path),
                          'ring-2 ring-blue-500/30 bg-blue-500/10': dragOverPath === file.path && file.type === 'directory'
                        }"
                        @click.stop="handleSingleClick(file, $event)"
                        @dblclick.stop="handleDoubleClick(file)"
                        @contextmenu.prevent.stop="(e) => toggleMenu(file, e)"
                        :draggable="renamingPath !== file.path"
                        @dragstart="(e) => handleDragStart(file, e)"
                        @dragover.prevent="(e) => handleItemDragOver(file, e)"
                        @dragleave="() => handleItemDragLeave(file)"
                        @drop.prevent="(e) => handleItemDrop(file, e)"
                      >
                        <div class="mb-1.5 pointer-events-none relative flex justify-center items-end h-[52px] w-full transition-transform duration-200 group-hover:scale-105">
                          <div class="w-[48px] h-[48px] flex items-center justify-center relative">
                            <div
                              v-if="iconFor(file)?.kind === 'svg'"
                              class="w-full h-full flex items-center justify-center rounded-xl"
                              :class="iconFor(file)?.bgClass || ''"
                            >
                              <component :is="iconFor(file)?.icon" :size="24" stroke-width="1.8" :class="iconFor(file)?.fgClass || ''" />
                            </div>
                            <img
                              v-else
                              :src="iconSrcFor(file)"
                              class="w-full h-full object-cover rounded-xl transition-transform duration-200"
                              :alt="fileLabel(file)"
                              loading="lazy"
                            />
                            <div v-if="showVideoBadge(file)" class="absolute bottom-1 right-1 pointer-events-none">
                              <div class="w-[18px] h-[18px] rounded-full bg-black/35 backdrop-blur-sm flex items-center justify-center">
                                <Play class="text-white/90" :size="10" stroke-width="2.5" />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div class="w-[80px] -mx-[22px] px-1">
                          <input
                            v-if="renamingPath === file.path"
                            ref="renameInputRef"
                            v-model="renameDraft"
                            class="w-full text-xs leading-tight text-center font-medium px-1.5 py-1 rounded-md outline-none select-text text-black bg-white border border-black/10"
                            @click.stop
                            @mousedown.stop
                            @keydown.enter.prevent="commitRenameFromDraft(file)"
                            @keydown.esc.prevent="cancelRename"
                            @blur="commitRenameFromDraft(file)"
                          />
                          <span
                            v-else
                            class="text-xs leading-tight text-center break-all w-full h-[34px] overflow-hidden font-medium px-1.5 py-0.5 [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] text-black"
                            :title="fileLabel(file)"
                          >
                            {{ fileLabel(file) }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
        <div class="shrink-0 bg-white/70 backdrop-blur-xl border-t border-black/5">
          <AppFileBrowserBottomBar 
            :path="currentPath"
            :window-width="windowWidth"
            @navigate="navigateTo"
          />
        </div>
      </div>
    </n-layout>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, reactive, nextTick } from 'vue';
import { ImageOff, Check, Star, Play } from 'lucide-vue-next';
import { NLayout, NLayoutSider, NSpin, NEmpty, NIcon } from 'naive-ui';
import AppFileBrowserTopBar from './components/AppFileBrowserTopBar.vue';
import AppFileBrowserBottomBar from './components/AppFileBrowserBottomBar.vue';
import AppFileBrowserSidebar from './components/AppFileBrowserSidebar.vue';
import { FILE_EXTENSIONS, getDragFiles, getDragPayload, getFileExt, getPathBaseName, joinPath, setDragPayload, useOs } from '@/os';

const isImageFile = (file) => FILE_EXTENSIONS.IMAGE.has(getFileExt(String(file?.name || '')));
const isVideoFile = (file) => FILE_EXTENSIONS.VIDEO.has(getFileExt(String(file?.name || '')));

const props = defineProps({
  files: {
    type: Array,
    default: () => []
  },
});

// Initialize logic
const getInitialPath = () => {
  const first = Array.isArray(props.files) ? props.files[0] : null;
  if (!first?.path) return '/';
  if (first.type === 'dir' || first.type === 'directory') return first.path;
  const p = String(first.path);
  return p.includes('/') ? (p.substring(0, p.lastIndexOf('/')) || '/') : '/';
};

const createFileBrowser = (initialPath = '/') => {
  const os = useOs();
  const { api, ui } = os;
  const { searchResults, refreshTrigger } = os.files.useRefs();

  const currentPath = ref(initialPath);
  const fileList = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const viewMode = ref('list');
  const selectedFiles = ref(new Set());
  const history = ref([initialPath]);
  const historyIndex = ref(0);
  const searchQuery = ref('');
  const fileTypeFilter = ref('ALL');
  const resetBrowseState = () => {
    searchQuery.value = '';
    fileTypeFilter.value = 'ALL';
    viewMode.value = 'list';
  };

  const loadFiles = async (path = currentPath.value) => {
    loading.value = true;
    error.value = null;
    selectedFiles.value.clear();

    try {
      let res;
      if (path === '::favorites::') {
        res = await api.getFavorites();
      } else {
        res = await api.getList(path);
      }

      const items = Array.isArray(res) ? res : (Array.isArray(res?.files) ? res.files : []);

      fileList.value = items.map(file => ({
        ...file,
        name: file.name || getPathBaseName(file.path),
        type: (file.isDir || file.type === 'directory') ? 'directory' : 'file'
      }));
    } catch (e) {
      error.value = e.message;
      ui.toast.error(`无法加载目录: ${e.message}`);
      fileList.value = [];
    } finally {
      loading.value = false;
    }
  };

  const navigateTo = (path) => {
    const targetPath = (!path || path === '') ? '/' : path;
    if (targetPath === currentPath.value) return;
    resetBrowseState();

    if (historyIndex.value < history.value.length - 1) {
      history.value = history.value.slice(0, historyIndex.value + 1);
    }
    history.value.push(targetPath);
    historyIndex.value = history.value.length - 1;

    currentPath.value = targetPath;
    loadFiles(targetPath);
  };

  const goBack = () => {
    if (historyIndex.value > 0) {
      historyIndex.value--;
      resetBrowseState();
      currentPath.value = history.value[historyIndex.value];
      loadFiles(currentPath.value);
    }
  };

  const goForward = () => {
    if (historyIndex.value < history.value.length - 1) {
      historyIndex.value++;
      resetBrowseState();
      currentPath.value = history.value[historyIndex.value];
      loadFiles(currentPath.value);
    }
  };

  const refresh = () => loadFiles(currentPath.value);

  const toggleSelection = (filePath, multiSelect = false) => {
    if (!multiSelect) {
      const wasSelected = selectedFiles.value.has(filePath);
      selectedFiles.value.clear();
      if (!wasSelected) selectedFiles.value.add(filePath);
    } else {
      if (selectedFiles.value.has(filePath)) {
        selectedFiles.value.delete(filePath);
      } else {
        selectedFiles.value.add(filePath);
      }
    }
  };

  const selectAll = () => {
    filteredItems.value.forEach(f => selectedFiles.value.add(f.path));
  };

  const clearSelection = () => {
    selectedFiles.value.clear();
  };

  const filteredItems = computed(() => {
    const q = String(searchQuery.value || '').trim();
    if (q) return Array.isArray(searchResults?.value) ? searchResults.value : [];

    return fileList.value.filter(item => {
      if (fileTypeFilter.value === 'ALL') return true;

      const ext = getFileExt(item.name);
      switch (fileTypeFilter.value) {
        case 'directory': return item.type === 'directory';
        case 'image': return FILE_EXTENSIONS.IMAGE.has(ext);
        case 'video': return FILE_EXTENSIONS.VIDEO.has(ext);
        case 'audio': return FILE_EXTENSIONS.AUDIO.has(ext);
        case 'model': return FILE_EXTENSIONS.MODEL.has(ext);
        case 'app': return FILE_EXTENSIONS.APP.has(ext);
        case '压缩': return FILE_EXTENSIONS.ARCHIVE.has(ext);
        case 'code': return FILE_EXTENSIONS.CODE.has(ext);
        case 'database': return FILE_EXTENSIONS.DATABASE.has(ext);
        case 'font': return FILE_EXTENSIONS.FONT.has(ext);
        case 'document':
          if (item.type === 'directory') return false;
          return !(
            FILE_EXTENSIONS.IMAGE.has(ext) ||
            FILE_EXTENSIONS.VIDEO.has(ext) ||
            FILE_EXTENSIONS.AUDIO.has(ext) ||
            FILE_EXTENSIONS.MODEL.has(ext) ||
            FILE_EXTENSIONS.APP.has(ext) ||
            FILE_EXTENSIONS.ARCHIVE.has(ext) ||
            FILE_EXTENSIONS.CODE.has(ext) ||
            FILE_EXTENSIONS.DATABASE.has(ext) ||
            FILE_EXTENSIONS.FONT.has(ext)
          );
        default: return true;
      }
    });
  });

  const categories = computed(() => {
    const list = filteredItems.value;
    const dirs = [];
    const imgs = [];
    const vids = [];
    const auds = [];
    const mods = [];
    const arcs = [];
    const docs = [];

    list.forEach((file) => {
      if (file.type === 'directory') {
        dirs.push(file);
        return;
      }

      const ext = getFileExt(file.name);
      if (FILE_EXTENSIONS.IMAGE.has(ext)) {
        imgs.push(file);
      } else if (FILE_EXTENSIONS.VIDEO.has(ext)) {
        vids.push(file);
      } else if (FILE_EXTENSIONS.AUDIO.has(ext)) {
        auds.push(file);
      } else if (FILE_EXTENSIONS.MODEL.has(ext)) {
        mods.push(file);
      } else if (FILE_EXTENSIONS.ARCHIVE.has(ext)) {
        arcs.push(file);
      } else {
        docs.push(file);
      }
    });

    return [
      { title: '文件夹', type: 'directory', items: dirs },
      { title: '照片', type: 'image', items: imgs },
      { title: '视频', type: 'video', items: vids },
      { title: '音频', type: 'audio', items: auds },
      { title: '3D 模型', type: 'model', items: mods },
      { title: '压缩包', type: '压缩', items: arcs },
      { title: '文档', type: 'document', items: docs }
    ];
  });

  const timelineGroups = computed(() => {
    const groups = {};
    const unknownLabel = '未知';

    const getFileDate = (file) => {
      const raw = file.modified || file.birthtime || file.created || file.updatedAt || file.createdAt;
      return raw ? new Date(raw) : new Date(0);
    };

    filteredItems.value.forEach(file => {
      let dateLabel = unknownLabel;
      const date = getFileDate(file);
      if (date.getTime() > 0) dateLabel = date.toLocaleDateString();

      if (!groups[dateLabel]) groups[dateLabel] = [];
      groups[dateLabel].push(file);
    });

    const sortedGroups = {};
    Object.keys(groups)
      .sort((a, b) => {
        if (a === unknownLabel) return 1;
        if (b === unknownLabel) return -1;
        const da = groups[a][0] ? getFileDate(groups[a][0]) : new Date(0);
        const db = groups[b][0] ? getFileDate(groups[b][0]) : new Date(0);
        return db - da;
      })
      .forEach(key => {
        sortedGroups[key] = groups[key].sort((a, b) => getFileDate(b) - getFileDate(a));
      });

    return sortedGroups;
  });

  const mediaItems = computed(() => {
    const list = filteredItems.value.filter((f) => isImageFile(f) || isVideoFile(f));

    const getTime = (file) => {
      const raw = file.modified || file.birthtime || file.created || file.updatedAt || file.createdAt;
      const t = raw ? new Date(raw).getTime() : 0;
      return Number.isFinite(t) ? t : 0;
    };

    return list.slice().sort((a, b) => getTime(b) - getTime(a));
  });

  watch(currentPath, (val) => os.files.search.setPath(val), { immediate: true });
  if (refreshTrigger) watch(refreshTrigger, () => refresh());
  watch(searchQuery, (val) => os.files.search.setQuery(val));

  return {
    currentPath,
    fileList,
    filteredItems,
    loading,
    error,
    viewMode,
    selectedFiles,
    historyIndex,
    history,
    searchQuery,
    fileTypeFilter,
    categories,
    timelineGroups,
    mediaItems,
    loadFiles,
    navigateTo,
    goBack,
    goForward,
    refresh,
    toggleSelection,
    selectAll,
    clearSelection,
    os
  };
};

const {
  currentPath,
  fileList, // raw list
  filteredItems, // filtered list
  loading,
  viewMode,
  selectedFiles,
  historyIndex,
  history,
  searchQuery,
  fileTypeFilter,
  categories,
  timelineGroups,
  mediaItems,
  loadFiles,
  navigateTo,
  goBack,
  goForward,
  refresh,
  toggleSelection,
  clearSelection,
  os // DI
} = createFileBrowser(getInitialPath());

const { ui } = os;
const api = os.api;
const { toast } = ui;
const { getFileUrl, getThumbUrl } = api;
const { clipboard, isSearching: globalIsSearching } = os.files.useRefs();
const fileOps = os.files.createOps({ currentPath, refresh });

// --- UI State & Logic ---

const rootRef = ref(null);
const containerRef = ref(null);
const isSidebarVisible = ref(true);
const highlightedItem = ref(null);
const isUploading = ref(false);
const uploadProgress = ref(0);
const isSearching = ref(false); // Local loading state for search

// Sync global searching state
watch(globalIsSearching, (val) => {
  isSearching.value = val;
}, { immediate: true });

const windowWidth = computed(() => {
  const w = os.window.data?.width;
  return typeof w === 'number' ? w : window.innerWidth;
});

const headerTitle = computed(() => {
  const p = String(currentPath.value || '/');
  if (p === '::favorites::') return '收藏';
  if (p === '/' || !p) return '文件';
  return getPathBaseName(p) || p;
});

const getMediaThumbSrc = (file) => {
  const path = String(file?.path || '');
  if (!path) return '';
  if (typeof getThumbUrl === 'function') return getThumbUrl(path);
  return getFileUrl(path);
};

const itemGridStyle = computed(() => {
  return {
    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
    gap: '0.5rem'
  };
});

const mediaColumnsStyle = computed(() => {
  const w = windowWidth.value;
  const count = w >= 1280 ? 6 : w >= 1024 ? 5 : w >= 768 ? 4 : w >= 640 ? 3 : 1;
  return {
    columnCount: String(count),
    columnGap: '0.75rem'
  };
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

  onUnmounted(() => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
    if (rafId) cancelAnimationFrame(rafId);
  });

  return { selectedKeys, selectionBox, startSelection };
};

const selectionState = createSelection({
  containerRef,
  itemSelector: '[data-path]',
  keyAttribute: 'data-path',
  onSelectionChange: (keys) => {
    selectedFiles.value = keys;
  }
});
const { selectionBox, startSelection } = selectionState;

// --- File Actions ---

const openFile = (file) => fileOps.open.file(file);

const handleSingleClick = (file, event) => {
  if (event.ctrlKey || event.metaKey) {
    toggleSelection(file.path, true);
  } else {
    highlightedItem.value = file.path;
    clearSelection();
    toggleSelection(file.path, false);
  }
};

const handleDoubleClick = (file) => {
  if (file.type === 'directory') {
    navigateTo(file.path);
  } else {
    openFile(file);
  }
};

const handleToggleSidebar = () => {
  isSidebarVisible.value = !isSidebarVisible.value;
};

// --- Renaming ---
const renamingPath = ref(null);
const renameDraft = ref('');
const renameInputRef = ref(null);
const dragOverPath = ref(null);

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

const createFolderAndRename = async () => {
  const baseName = '新建文件夹';
  const prevPaths = new Set((fileList.value || []).map((f) => f?.path).filter(Boolean));
  const res = await fileOps.dir.mkdir({ dirPath: String(currentPath.value || '/'), name: baseName });
  if (!res.ok) return;

  const createdDir = (fileList.value || []).find((f) => {
    if (!f?.path) return false;
    if (f.type !== 'directory') return false;
    return !prevPaths.has(f.path);
  });

  if (createdDir?.path) {
    renamingPath.value = createdDir.path;
    renameDraft.value = createdDir.name || '';
    focusRenameInput();
  }
};

const commitRename = async (file, newName) => {
  if (!newName || newName === file.name) {
    cancelRename();
    return;
  }
  try {
    const oldPath = file.path;
    
    await fileOps.fs.rename({ path: oldPath, newName });
    renamingPath.value = null;
    refresh();
  } catch (e) {
    toast.error(`重命名失败: ${e.message}`);
    cancelRename();
  }
};

const cancelRename = () => {
  renamingPath.value = null;
};

watch(renamingPath, (val) => {
  if (!val) return;
  const target = (fileList.value || []).find((f) => f?.path === val);
  renameDraft.value = target?.name || '';
  focusRenameInput();
});

const commitRenameFromDraft = async (file) => {
  await commitRename(file, renameDraft.value);
};

const triggerUpload = () => {
  const res = fileOps.upload.open(currentPath.value, { autoOpenSelect: true });
  if (!res.ok) toast.error('上传器应用未找到');
};

// --- Drag & Drop (External) ---
const isExternalDragOver = ref(false);

const handleExternalDragOver = (e) => {
  if (e.dataTransfer.types.includes('application/x-os-drag') || e.dataTransfer.types.includes('application/json') || e.dataTransfer.types.includes('Files')) {
    isExternalDragOver.value = true;
    e.dataTransfer.dropEffect = 'move';
  }
};

const handleExternalDragLeave = () => {
  isExternalDragOver.value = false;
};

const handleExternalDrop = async (e) => {
  isExternalDragOver.value = false;
  try {
    const payload = getDragPayload(e.dataTransfer);
    const dragFiles = getDragFiles(payload);
    if (dragFiles.length === 0) return;
    let moved = 0;
    for (const file of dragFiles) {
      const sourcePath = String(file?.path || '');
      if (!sourcePath) continue;
      const sourceDir = sourcePath.substring(0, sourcePath.lastIndexOf('/')) || '/';
      if (sourceDir === currentPath.value) continue;
      const fileName = sourcePath.split('/').pop();
      if (!fileName) continue;
      const res = await fileOps.fs.move({ from: sourcePath, to: joinPath(currentPath.value, fileName), refresh: false });
      if (res.ok) moved++;
    }
    if (moved > 0) {
      refresh();
      os.files.triggerRefresh();
    }
  } catch (e) {
      void e;
  }
};

const handleDragStart = (item, e) => {
  if (e.dataTransfer) {
    if (!selectedFiles.value.has(item.path)) {
      selectedFiles.value.clear();
      selectedFiles.value.add(item.path);
    }
    const dragFiles = filteredItems.value.filter(f => selectedFiles.value.has(f.path));
    const dragData = { kind: 'files', files: dragFiles, source: 'file-browser' };
    setDragPayload(e.dataTransfer, dragData);
    e.dataTransfer.effectAllowed = 'move';
  }
};

const handleItemDragOver = (file, e) => {
  if (file?.type !== 'directory') return;
  dragOverPath.value = file.path;
  e.stopPropagation();
  e.dataTransfer.dropEffect = 'move';
};

const handleItemDragLeave = (file) => {
  if (dragOverPath.value === file?.path) dragOverPath.value = null;
};

const handleItemDrop = async (file, e) => {
  dragOverPath.value = null;
  if (file?.type !== 'directory') return;
  e.stopPropagation();
  await handleDropOnFolder(file, e);
};

const iconFor = (file) => os.files.getIcon(file);
const iconSrcFor = (file) => {
  const icon = iconFor(file);
  if (!icon || icon.kind === 'svg') return '';
  return icon.src || icon.iconImage || '';
};
const fileLabel = (file) => String(file?.name || file?.path || '');
const showVideoBadge = (file) => {
  if (!file || file.type === 'directory') return false;
  return iconFor(file)?.isVideo === true;
};

const handleDropOnFolder = async (targetFile, e) => {
   if (targetFile.type !== 'directory') return;
   try {
     const payload = getDragPayload(e.dataTransfer);
     const dragFiles = getDragFiles(payload);
     if (dragFiles.length === 0) return;

     let moved = 0;
     for (const file of dragFiles) {
       const sourcePath = String(file?.path || '');
       if (!sourcePath) continue;
       if (sourcePath === targetFile.path) continue;
       const sourceDir = sourcePath.substring(0, sourcePath.lastIndexOf('/')) || '/';
       if (sourceDir === targetFile.path) continue;
       const fileName = sourcePath.split('/').pop();
       if (!fileName) continue;
       const destPath = joinPath(targetFile.path, fileName);
       if (destPath === sourcePath) continue;
       const res = await fileOps.fs.move({ from: sourcePath, to: destPath, refresh: false });
       if (res.ok) moved++;
     }

     if (moved > 0) {
       refresh();
       os.files.triggerRefresh();
     }
   } catch (err) {
     void err;
   }
};

// --- Context Menu ---
const currentSelection = ref([]);
const sortType = ref('名称');

const unwrap = (v) => (v && typeof v === 'object' && 'value' in v ? v.value : v);
const normalizeFiles = (ctx) => {
  const files = unwrap(ctx?.files);
  if (Array.isArray(files)) return files.filter(Boolean);
  const file = unwrap(ctx?.file);
  return file ? [file] : [];
};

const normalizeApiPath = (input) => {
  const s = String(input || '').trim();
  if (!s) return '';
  if (s === '.trash') return '/.trash';
  if (s.startsWith('/')) return s;
  return `/${s}`;
};

const isArchiveFile = (file) => {
  if (!file || !file.name) return false;
  const ext = String(file.name).split('.').pop().toLowerCase();
  return ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext);
};

const buildFileBrowserContextMenuOptions = ({ file, files, clipboard, currentPath }) => {
  const normalizedCurrentPath = normalizeApiPath(currentPath);
  const isTrashView = normalizedCurrentPath === '/.trash' || normalizedCurrentPath.startsWith('/.trash/');
  const filePath = normalizeApiPath(file?.path);
  const isTrashItem = !!filePath && filePath.startsWith('/.trash/');
  const clipboardValue = unwrap(clipboard);
  const hasClipboardContent = !!(clipboardValue && clipboardValue.files && clipboardValue.files.length > 0);

  if (Array.isArray(files) && files.length > 1) {
    if (isTrashView) {
      return [
        { label: '批量还原', key: 'restore-multi', iconKey: 'rotateCcw' },
        { label: '批量彻底删除', key: 'delete-multi', iconKey: 'trash2', danger: true }
      ];
    }

    return [
      { label: '打开', key: 'open-multi', iconKey: 'folderOpen' },
      { label: '压缩', key: 'archive-multi', iconKey: 'archive' },
      { type: 'divider' },
      { label: '剪切', key: 'cut-multi', iconKey: 'scissors' },
      { label: '复制', key: 'copy-multi', iconKey: 'copy' },
      { type: 'divider' },
      { label: '删除', key: 'delete-multi', iconKey: 'trash2', danger: true }
    ];
  }

  if (file) {
    if (isTrashItem) {
      return [
        { label: '还原', key: 'restore', iconKey: 'rotateCcw' },
        { label: '彻底删除', key: '删除', iconKey: 'trash2', danger: true },
        { type: 'divider' },
        { label: '属性', key: '属性', iconKey: 'info' }
      ];
    }

    const isArchive = isArchiveFile(file);
    const options = [{ label: '打开', key: '打开', iconKey: 'folderOpen' }];

    options.push({ label: '打开方式...', key: 'open-with', iconKey: 'externalLink' });

    if (isArchive) {
      options.push({ label: '解压到当前', key: 'extract', iconKey: 'archive' });
    }

    options.push({ label: '重命名', key: '重命名', iconKey: 'edit2' });
    options.push({ label: '创建快捷方式', key: 'create-shortcut', iconKey: 'link2' });
    options.push({ type: 'divider' });

    const moreOptions = [
      { label: '剪切', key: '剪切', iconKey: 'scissors' },
      { label: '复制', key: '复制', iconKey: 'copy' },
      { label: '创建链接', key: 'create-link', iconKey: 'link2' },
      {
        label: file?.isFavorite ? '取消收藏' : '添加到收藏',
        key: 'favorite',
        iconKey: 'star',
        textColor: file?.isFavorite ? '#f59e0b' : undefined
      },
      { label: '属性', key: '属性', iconKey: 'info' }
    ];

    options.push({
      label: '更多操作',
      key: 'more-actions',
      iconKey: 'moreHorizontal',
      children: moreOptions
    });

    options.push({ type: 'divider' });
    options.push({ label: '删除', key: '删除', iconKey: 'trash2', danger: true });

    return options;
  }

  const options = [
    { label: '新建文件夹', key: 'new-folder', iconKey: 'folder' },
    { label: '上传文件', key: 'upload', iconKey: 'uploadCloud' },
    { label: '属性', key: '属性', iconKey: 'info' }
  ];

  if (hasClipboardContent) {
    options.push({ label: '粘贴', key: '粘贴', iconKey: 'clipboard' });
  }

  options.push({ type: 'divider' });
  options.push({ label: '刷新', key: '刷新', iconKey: 'refreshCw' });

  return options;
};

const handleDelete = async (ctx) => {
  await fileOps.trash.delete({ files: normalizeFiles(ctx) });
};

const handleRestore = async (ctx) => {
  await fileOps.trash.restore({ files: normalizeFiles(ctx) });
};

const handleProperties = (ctx) => {
  fileOps.open.properties(normalizeFiles(ctx));
};

const handleCreateShortcut = (ctx) => {
  const files = normalizeFiles(ctx);
  const first = files[0];
  if (!first) return;
  fileOps.open.shortcut(first);
};

const handleCreateLink = async (ctx) => {
  const files = normalizeFiles(ctx);
  const first = files[0];
  if (!first) return;
  await fileOps.share.createLink({ file: first });
};

const handleFavorite = async (ctx) => {
  const files = normalizeFiles(ctx);
  const first = files[0];
  if (!first) return;
  await fileOps.favorite.toggle({ file: first });
};

const handleOpenWith = (ctx) => {
  const files = normalizeFiles(ctx);
  const first = files[0];
  if (!first) return;
  fileOps.open.with(first);
};

const handleExtract = async (ctx) => {
  const files = normalizeFiles(ctx);
  const first = files[0];
  if (!first) return;
  await fileOps.archive.extract(first);
};

const handleArchiveMulti = (ctx) => {
  const files = normalizeFiles(ctx);
  fileOps.archive.create(files);
};

const handleOpen = (file) => {
  if (!file) return;
  if (file.type === 'directory') navigateTo(file.path);
  else openFile(file);
};

const handleContextMenu = (e) => {
  e.preventDefault();
  currentSelection.value = [];
  os.ui.contextMenu.open({
    event: e,
    file: null,
    files: [],
    clipboard,
    options: buildFileBrowserContextMenuOptions({
      file: null,
      files: [],
      clipboard,
      currentPath: currentPath.value
    }),
    currentPath,
    refresh,
    sortType,
    showSort: false,
    showRefresh: true,
    showSettings: false,
    handlers: {
      'new-folder': createFolderAndRename,
      upload: triggerUpload,
      '粘贴': async () => {
        await fileOps.clipboard.paste({ targetPath: String(currentPath.value || '/'), refresh });
      },
      '刷新': refresh,
      '属性': handleProperties,
      '打开': (ctx) => handleOpen(unwrap(ctx?.file)),
      'open-multi': (ctx) => normalizeFiles(ctx).forEach(f => handleOpen(f)),
      '重命名': (ctx) => {
        const files = normalizeFiles(ctx);
        if (files.length === 1) renamingPath.value = files[0].path;
        else toast.info('请选择单个文件进行重命名');
      },
      '剪切': (ctx) => fileOps.clipboard.cut(normalizeFiles(ctx)),
      'cut-multi': (ctx) => fileOps.clipboard.cut(normalizeFiles(ctx)),
      '复制': (ctx) => fileOps.clipboard.copy(normalizeFiles(ctx)),
      'copy-multi': (ctx) => fileOps.clipboard.copy(normalizeFiles(ctx)),
      '删除': handleDelete,
      'delete-multi': handleDelete,
      restore: handleRestore,
      'restore-multi': handleRestore,
      favorite: handleFavorite,
      'create-shortcut': handleCreateShortcut,
      'create-link': handleCreateLink,
      'open-with': handleOpenWith,
      extract: handleExtract,
      'archive-multi': handleArchiveMulti
    }
  });
};

const toggleMenu = (file, e) => {
  e.preventDefault();
  e.stopPropagation();

  if (!selectedFiles.value.has(file.path)) {
    clearSelection();
    toggleSelection(file.path, false);
    highlightedItem.value = file.path;
  }

  currentSelection.value = filteredItems.value.filter(f => selectedFiles.value.has(f.path));

  os.ui.contextMenu.open({
    event: e,
    file,
    files: currentSelection.value,
    clipboard,
    options: buildFileBrowserContextMenuOptions({
      file,
      files: currentSelection.value,
      clipboard,
      currentPath: currentPath.value
    }),
    currentPath,
    refresh,
    sortType,
    showSort: false,
    showRefresh: true,
    showSettings: false,
    handlers: {
      'new-folder': createFolderAndRename,
      upload: triggerUpload,
      '粘贴': async () => {
        await fileOps.clipboard.paste({ targetPath: String(currentPath.value || '/'), refresh });
      },
      '刷新': refresh,
      '属性': handleProperties,
      '打开': (ctx) => handleOpen(unwrap(ctx?.file)),
      'open-multi': (ctx) => normalizeFiles(ctx).forEach(f => handleOpen(f)),
      '重命名': (ctx) => {
        const files = normalizeFiles(ctx);
        if (files.length === 1) renamingPath.value = files[0].path;
        else toast.info('请选择单个文件进行重命名');
      },
      '剪切': (ctx) => fileOps.clipboard.cut(normalizeFiles(ctx)),
      'cut-multi': (ctx) => fileOps.clipboard.cut(normalizeFiles(ctx)),
      '复制': (ctx) => fileOps.clipboard.copy(normalizeFiles(ctx)),
      'copy-multi': (ctx) => fileOps.clipboard.copy(normalizeFiles(ctx)),
      '删除': handleDelete,
      'delete-multi': handleDelete,
      restore: handleRestore,
      'restore-multi': handleRestore,
      favorite: handleFavorite,
      'create-shortcut': handleCreateShortcut,
      'create-link': handleCreateLink,
      'open-with': handleOpenWith,
      extract: handleExtract,
      'archive-multi': handleArchiveMulti
    }
  });
};

onMounted(() => {
  // Initial load
  if (!fileList.value.length) loadFiles();
});

onUnmounted(() => {
  void 0;
});

// Helper
const formatSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};
</script>
