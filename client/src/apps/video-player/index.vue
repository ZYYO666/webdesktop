<template>
  <div
    v-if="!hasFile"
    class="h-full w-full bg-gradient-to-b from-slate-50 to-white flex flex-col p-8"
  >
    <div class="flex-1 flex items-center justify-center">
      <div class="w-full max-w-xl text-center">
      <div class="mx-auto w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
        <FolderSearch :size="24" />
      </div>
      <div class="mt-4 text-xl font-semibold text-slate-900">{{ '打开媒体文件' }}</div>
      <div class="mt-2 text-sm text-slate-500 leading-relaxed">
        {{ '支持图片 / 视频 / 音频预览，提供缩放、全屏、下载与文件夹定位。' }}
      </div>
      <div class="mt-5 flex items-center justify-center gap-3">
        <button
          type="button"
          class="h-10 px-5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors"
          @click="pickFile"
        >
          {{ '选择文件' }}
        </button>
        <button
          type="button"
          class="h-10 px-5 rounded-xl bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors flex items-center gap-2"
          @click="showUrlModal = true"
        >
          <Link2 :size="16" />
          {{ '打开 URL' }}
        </button>
      </div>
      <div class="mt-3 text-xs text-slate-400">
        {{ '也可以从文件管理器双击打开。' }}
      </div>
    </div>
    </div>
  </div>

  <div
    v-else
    ref="rootRef"
    class="h-full w-full flex flex-col bg-white text-slate-900 select-none"
    tabindex="0"
    @keydown="handleKeydown"
  >
    <div class="flex-1 min-h-0 relative overflow-hidden bg-black" @click="toggleControls">
      <div
        v-if="mediaKind === 'image'"
        class="absolute inset-0 flex items-center justify-center bg-slate-50"
        @wheel.prevent="handleImageWheel"
        @mousedown="handleImageMouseDown"
        @mousemove="handleImageMouseMove"
        @mouseup="handleImageMouseUp"
        @mouseleave="handleImageMouseUp"
      >
        <img
          :key="currentFile?.path"
          :src="url"
          :alt="displayName"
          class="max-w-full max-h-full object-contain will-change-transform"
          draggable="false"
          :style="{
            transform: `translate(${imageTranslateX}px, ${imageTranslateY}px) scale(${imageScale})`
          }"
        />
      </div>

      <div
        v-else-if="mediaKind === 'video'"
        ref="artContainerRef"
        class="absolute inset-0 w-full h-full bg-black"
      ></div>

      <div
        v-else-if="mediaKind === 'audio'"
        class="absolute inset-0 flex flex-col items-center justify-center gap-6 px-6 bg-slate-50"
      >
        <div class="w-28 h-28 rounded-3xl bg-white flex items-center justify-center border border-slate-200 shadow-sm">
          <MusicIcon :size="44" class="text-slate-400" />
        </div>
        <div class="text-center max-w-[720px]">
          <div class="text-lg font-semibold truncate">{{ displayName }}</div>
          <div class="text-xs text-slate-500 mt-1 truncate">{{ currentFile?.path }}</div>
        </div>
        <audio
          ref="audioRef"
          :key="currentFile?.path"
          :src="url"
          @timeupdate="onAudioTimeUpdate"
          @loadedmetadata="onAudioLoadedMetadata"
          @ended="onAudioEnded"
        />
      </div>

      <div v-else class="absolute inset-0 flex items-center justify-center text-slate-500">
        {{ '不支持的媒体类型' }}
      </div>
    </div>

    <div v-show="controlsVisible" class="shrink-0 px-2 pb-2 flex items-center justify-center gap-2 bg-white pt-2" @click.stop>
      <button
        class="h-8 w-8 rounded-lg text-slate-600 hover:text-slate-900 disabled:opacity-30 flex items-center justify-center"
        :disabled="!canPrev"
        @click="prev"
        title="上一个"
      >
        <ChevronLeft :size="18" />
      </button>
      <button
        class="h-8 w-8 rounded-lg text-slate-600 hover:text-slate-900 disabled:opacity-30 flex items-center justify-center"
        :disabled="!canNext"
        @click="next"
        title="下一个"
      >
        <ChevronRight :size="18" />
      </button>

      <template v-if="mediaKind === 'image'">
        <button
          class="h-8 w-8 rounded-lg text-slate-600 hover:text-slate-900 flex items-center justify-center"
          @click="zoomOut"
          title="缩小"
        >
          <Minus :size="16" />
        </button>
        <button
          class="h-8 w-8 rounded-lg text-slate-600 hover:text-slate-900 flex items-center justify-center"
          @click="zoomIn"
          title="放大"
        >
          <Plus :size="16" />
        </button>
        <button
          class="h-8 w-8 rounded-lg text-slate-600 hover:text-slate-900 flex items-center justify-center"
          @click="fitImage"
          title="适应屏幕"
        >
          <Scan :size="16" />
        </button>
        <button
          class="h-8 w-8 rounded-lg text-slate-600 hover:text-slate-900 flex items-center justify-center"
          @click="resetImageTransform"
          title="重置"
        >
          <RotateCcw :size="16" />
        </button>
      </template>

      <template v-else-if="mediaKind === 'audio'">
        <button
          class="h-8 w-8 rounded-lg text-slate-600 hover:text-slate-900 flex items-center justify-center"
          @click="toggleAudioPlay"
        >
          <Pause v-if="isAudioPlaying" :size="18" />
          <Play v-else :size="18" class="ml-0.5" />
        </button>
        <div class="w-56">
          <n-slider
            v-model:value="audioProgress"
            :step="0.1"
            :tooltip="false"
            @update:value="onAudioSeek"
          />
        </div>
        <button
          class="h-8 w-8 rounded-lg text-slate-600 hover:text-slate-900 flex items-center justify-center"
          @click="toggleMute"
        >
          <VolumeX v-if="audioVolume === 0" :size="18" />
          <Volume2 v-else :size="18" />
        </button>
        <div class="w-24">
          <n-slider
            v-model:value="audioVolume"
            :max="1"
            :step="0.01"
            :tooltip="false"
          />
        </div>
      </template>

      <button
        class="h-8 w-8 rounded-lg text-slate-600 hover:text-slate-900 flex items-center justify-center"
        @click="showInFolder"
        title="在文件夹中显示"
      >
        <FolderOpen :size="16" />
      </button>

      <a
        class="h-8 w-8 rounded-lg text-slate-600 hover:text-slate-900 flex items-center justify-center"
        :href="url"
        :download="displayName"
        title="下载"
      >
        <Download :size="16" />
      </a>

      <button
        class="h-8 w-8 rounded-lg text-slate-600 hover:text-slate-900 flex items-center justify-center"
        @click="pickFile"
        title="打开文件"
      >
        <FolderSearch :size="16" />
      </button>

      <button
        class="h-8 w-8 rounded-lg text-slate-600 hover:text-slate-900 flex items-center justify-center"
        @click="toggleFullscreen"
        title="全屏"
      >
        <Minimize2 v-if="isFullscreen" :size="18" />
        <Maximize2 v-else :size="18" />
      </button>
    </div>

    </div>

    <n-modal
      v-model:show="showUrlModal"
      preset="card"
      title="打开 URL"
      class="max-w-xl"
      :bordered="false"
    >
      <div class="space-y-4">
        <n-input
          v-model:value="urlDraft"
          type="textarea"
          placeholder="输入媒体地址（http/https/m3u8）"
          :autosize="{ minRows: 2, maxRows: 4 }"
        />
        
        <div class="flex items-center gap-2 text-sm text-slate-600">
          <span>类型：</span>
          <n-radio-group v-model:value="urlType" name="media-type">
            <n-space>
              <n-radio value="video">视频</n-radio>
              <n-radio value="image">图片</n-radio>
              <n-radio value="audio">音频</n-radio>
            </n-space>
          </n-radio-group>
        </div>

        <div class="flex items-center justify-between gap-3 pt-2">
          <n-button quaternary @click="pasteUrl">{{ '粘贴' }}</n-button>
          <div class="flex items-center gap-2">
            <n-button @click="showUrlModal = false">{{ '取消' }}</n-button>
            <n-button type="primary" :disabled="!urlDraft" @click="confirmPlayUrl">
              {{ '播放' }}
            </n-button>
          </div>
        </div>
      </div>
    </n-modal>
</template>

<script setup>
import { ref, onBeforeUnmount, onMounted, watch, computed, nextTick } from 'vue';
import Artplayer from 'artplayer';
import Hls from 'hls.js';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FolderOpen,
  FolderSearch,
  Maximize2,
  Minus,
  Music as MusicIcon,
  Minimize2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Scan,
  Volume2,
  VolumeX,
  Link2,
} from 'lucide-vue-next';
import { NSlider, NModal, NInput, NButton, NRadio, NRadioGroup, NSpace } from 'naive-ui';
import { FILE_EXTENSIONS, getFileExt, getParentDirPath, getPathBaseName, isDirectoryFile, reopenCurrentAppWindow, useOs } from '@/os';

const os = useOs();
const api = os.api;

const props = defineProps({
  files: { type: Array, default: () => [] },
  componentProps: { type: Object, default: () => ({}) }
});

const artContainerRef = ref(null);
const audioRef = ref(null);
const rootRef = ref(null);
const isFullscreen = ref(false);
const controlsVisible = ref(true);

const target = computed(() => {
  const fileList = props.files.length > 0 ? props.files : (props.componentProps?.files || []);
  return Array.isArray(fileList) ? fileList[0] : null;
});

const currentFile = ref(null);
const hasFile = computed(() => !!(currentFile.value?.path || currentFile.value?.url));
const url = computed(() => {
  if (currentFile.value?.url) return currentFile.value.url;
  return currentFile.value?.path ? String(api.getFileUrl(currentFile.value.path) || '') : '';
});
const displayName = computed(() => {
  if (currentFile.value?.name) return currentFile.value.name;
  return getPathBaseName(String(currentFile.value?.path || '')) || '';
});

const mediaKind = computed(() => {
  if (currentFile.value?.type === 'image') return 'image';
  if (currentFile.value?.type === 'video') return 'video';
  if (currentFile.value?.type === 'audio') return 'audio';

  const name = String(currentFile.value?.name || currentFile.value?.path || '');
  const ext = getFileExt(name);
  if (FILE_EXTENSIONS.IMAGE.has(ext)) return 'image';
  if (FILE_EXTENSIONS.VIDEO.has(ext)) return 'video';
  if (FILE_EXTENSIONS.AUDIO.has(ext)) return 'audio';
  return 'other';
});

// URL Modal
const showUrlModal = ref(false);
const urlDraft = ref('');
const urlType = ref('video');

const pasteUrl = async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) urlDraft.value = text;
  } catch (err) {
    os.ui.toast.error('读取剪贴板失败');
  }
};

const confirmPlayUrl = () => {
  if (!urlDraft.value) return;
  const u = urlDraft.value.trim();
  const name = u.split('/').pop() || 'Network Stream';
  
  // Create a pseudo file object
  setCurrentFile({
    name,
    url: u,
    type: urlType.value
  });
  
  showUrlModal.value = false;
  urlDraft.value = '';
};

// Artplayer Logic
let art = null;
let hls = null;

const destroyHls = () => {
  if (hls) {
    hls.destroy();
    hls = null;
  }
};

const destroyArt = () => {
  if (art) {
    art.destroy(false);
    art = null;
  }
  destroyHls();
};

const initArt = async () => {
  destroyArt();
  await nextTick();
  
  const container = artContainerRef.value;
  if (!container || !url.value) return;

  art = new Artplayer({
    container,
    url: url.value,
    title: displayName.value,
    autoplay: true,
    autoSize: true,
    playbackRate: true,
    aspectRatio: true,
    setting: true,
    pip: true,
    fullscreen: true,
    fullscreenWeb: true,
    mutex: true,
    theme: '#3b82f6',
    lang: 'zh-cn',
    customType: {
      m3u8: (video, url) => {
        destroyHls();

        const nativeOk = !!video?.canPlayType && video.canPlayType('application/vnd.apple.mpegurl') !== '';
        if (nativeOk) {
          video.src = url;
          video.play().catch(() => void 0);
          return;
        }

        if (!Hls.isSupported()) {
          os.ui.toast.error('当前环境不支持 HLS 播放');
          return;
        }

        hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (data && data.fatal) {
            os.ui.toast.error('HLS 播放错误: ' + data.details);
            destroyHls();
          }
        });
      }
    }
  });
  
  // Sync fullscreen state
  art.on('fullscreen', () => {
    // We don't need to do anything here as the document fullscreen change listener will handle it
  });
};

const toggleControls = () => {
  if (mediaKind.value === 'image' && didImageDrag.value) {
    didImageDrag.value = false;
    return;
  }
  controlsVisible.value = !controlsVisible.value;
};

const closeSelf = () => {
  os.window.close();
};

const syncFullscreen = () => {
  const el = rootRef.value;
  isFullscreen.value = !!(el && document.fullscreenElement === el);
};

const toggleFullscreen = async () => {
  const el = rootRef.value;
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    if (!el?.requestFullscreen) return;
    await el.requestFullscreen();
  } catch {
    // ignore
  }
};

const normalizeList = (res) => {
  const items = Array.isArray(res) ? res : (Array.isArray(res?.files) ? res.files : []);
  return items
    .filter(Boolean)
    .map((file) => ({
      ...file,
      name: file.name || getPathBaseName(file.path),
      type: (file.isDir || file.type === 'directory' || file.type === 'dir') ? 'directory' : 'file'
    }))
    .filter((file) => Boolean(file.path));
};

const contextList = ref([]);
const contextIndex = ref(-1);

const refreshContext = async () => {
  const f = currentFile.value;
  if (!f?.path) {
    contextList.value = [];
    contextIndex.value = -1;
    return;
  }
  if (isDirectoryFile(f)) {
    contextList.value = [];
    contextIndex.value = -1;
    return;
  }

  const dir = getParentDirPath(f.path);
  try {
    const res = await api.getList(dir);
    const list = normalizeList(res)
      .filter((x) => x.type !== 'directory')
      .filter((x) => {
        const ext = getFileExt(String(x.name || x.path || ''));
        return FILE_EXTENSIONS.IMAGE.has(ext) || FILE_EXTENSIONS.VIDEO.has(ext) || FILE_EXTENSIONS.AUDIO.has(ext);
      })
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

    contextList.value = list;
    contextIndex.value = list.findIndex((x) => x.path === f.path);
  } catch {
    contextList.value = [];
    contextIndex.value = -1;
  }
};

const canPrev = computed(() => contextList.value.length > 1 && contextIndex.value > 0);
const canNext = computed(() => contextList.value.length > 1 && contextIndex.value >= 0 && contextIndex.value < contextList.value.length - 1);

const setCurrentFile = (file) => {
  currentFile.value = file ? { ...file } : null;
};

const prev = () => {
  if (!canPrev.value) return;
  const idx = contextIndex.value - 1;
  const nextFile = contextList.value[idx];
  contextIndex.value = idx;
  setCurrentFile(nextFile);
};

const next = () => {
  if (!canNext.value) return;
  const idx = contextIndex.value + 1;
  const nextFile = contextList.value[idx];
  contextIndex.value = idx;
  setCurrentFile(nextFile);
};

const pickFile = () => {
  os.stores.windows.openFileSelector?.((selectedFile) => {
    if (!selectedFile) return;

    reopenCurrentAppWindow(os, {
      title: selectedFile.name || selectedFile.path,
      componentProps: { files: [selectedFile] }
    });
    closeSelf();
  }, { allowedTypes: [...FILE_EXTENSIONS.IMAGE, ...FILE_EXTENSIONS.VIDEO, ...FILE_EXTENSIONS.AUDIO] });
};

const showInFolder = () => {
  const p = String(currentFile.value?.path || '');
  if (!p) return;
  const dir = getParentDirPath(p);
  os.stores.windows.openFile({ type: 'dir', path: dir }, 'file-browser');
};

const handleKeydown = (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
      return;
    }
    closeSelf();
    return;
  }
  if (e.key === 'ArrowLeft') {
    if (mediaKind.value !== 'video') { // Let artplayer handle video seek
      e.preventDefault();
      prev();
      return;
    }
  }
  if (e.key === 'ArrowRight') {
    if (mediaKind.value !== 'video') { // Let artplayer handle video seek
      e.preventDefault();
      next();
      return;
    }
  }
  if (e.key === ' ' || e.code === 'Space') {
    if (mediaKind.value === 'audio') {
      e.preventDefault();
      toggleAudioPlay();
      return;
    }
    // Artplayer handles space for video
  }
};

watch(
  target,
  async (val) => {
    setCurrentFile((val?.path || val?.url) ? val : null);
    await refreshContext();
    if (mediaKind.value === 'image') resetImageTransform();
  },
  { immediate: true }
);

watch(
  () => currentFile.value?.path,
  async () => {
    await refreshContext();
    if (mediaKind.value === 'image') resetImageTransform();
  }
);

watch(
  [() => mediaKind.value, url],
  async ([kind, u]) => {
    if (kind === 'video' && u) {
      await initArt();
    } else {
      destroyArt();
    }
  },
  { immediate: true }
);

onMounted(async () => {
  await refreshContext();
  rootRef.value?.focus?.();
  document.addEventListener('fullscreenchange', syncFullscreen);
  syncFullscreen();
});

onBeforeUnmount(() => {
  destroyArt();
  document.removeEventListener('fullscreenchange', syncFullscreen);
});

const imageScale = ref(1);
const imageTranslateX = ref(0);
const imageTranslateY = ref(0);
const isImageDragging = ref(false);
const didImageDrag = ref(false);
const imageDragStartX = ref(0);
const imageDragStartY = ref(0);

const resetImageTransform = () => {
  imageScale.value = 1;
  imageTranslateX.value = 0;
  imageTranslateY.value = 0;
};

const fitImage = () => {
  resetImageTransform();
};

const zoomIn = () => {
  imageScale.value = Math.min(6, Number((imageScale.value + 0.2).toFixed(2)));
};

const zoomOut = () => {
  imageScale.value = Math.max(0.2, Number((imageScale.value - 0.2).toFixed(2)));
  if (imageScale.value <= 1) {
    imageTranslateX.value = 0;
    imageTranslateY.value = 0;
  }
};

const handleImageWheel = (e) => {
  if (mediaKind.value !== 'image') return;
  const delta = Math.sign(e.deltaY);
  if (delta > 0) zoomOut();
  else zoomIn();
};

const handleImageMouseDown = (e) => {
  if (mediaKind.value !== 'image') return;
  if (imageScale.value <= 1) return;
  isImageDragging.value = true;
  imageDragStartX.value = e.clientX - imageTranslateX.value;
  imageDragStartY.value = e.clientY - imageTranslateY.value;
};

const handleImageMouseMove = (e) => {
  if (!isImageDragging.value) return;
  didImageDrag.value = true;
  imageTranslateX.value = e.clientX - imageDragStartX.value;
  imageTranslateY.value = e.clientY - imageDragStartY.value;
};

const handleImageMouseUp = () => {
  isImageDragging.value = false;
};

const audioCurrentTime = ref(0);
const audioDuration = ref(0);
const audioProgress = ref(0);
const audioVolume = ref(1);
const isAudioPlaying = ref(false);

const syncAudioVolume = () => {
  const el = audioRef.value;
  if (!el) return;
  el.volume = audioVolume.value;
};

watch(audioVolume, () => syncAudioVolume());

const toggleMute = () => {
  audioVolume.value = audioVolume.value === 0 ? 1 : 0;
};

const toggleAudioPlay = () => {
  const el = audioRef.value;
  if (!el) return;
  if (el.paused) {
    el.play?.().then(() => { isAudioPlaying.value = true; }).catch(() => { isAudioPlaying.value = false; });
  } else {
    el.pause?.();
    isAudioPlaying.value = false;
  }
};

const onAudioLoadedMetadata = () => {
  const el = audioRef.value;
  if (!el) return;
  audioDuration.value = el.duration || 0;
  syncAudioVolume();
  el.play?.().then(() => { isAudioPlaying.value = true; }).catch(() => { isAudioPlaying.value = false; });
};

const onAudioTimeUpdate = () => {
  const el = audioRef.value;
  if (!el) return;
  audioCurrentTime.value = el.currentTime || 0;
  const d = audioDuration.value || el.duration || 0;
  if (d > 0) audioProgress.value = (audioCurrentTime.value / d) * 100;
};

const onAudioEnded = () => {
  isAudioPlaying.value = false;
  audioCurrentTime.value = 0;
  audioProgress.value = 0;
};

const onAudioSeek = (val) => {
  const el = audioRef.value;
  if (!el) return;
  const d = audioDuration.value || el.duration || 0;
  if (!d) return;
  const t = (val / 100) * d;
  el.currentTime = t;
  audioCurrentTime.value = t;
};

watch(
  () => mediaKind.value,
  (kind) => {
    if (kind !== 'audio') {
      const el = audioRef.value;
      el?.pause?.();
      isAudioPlaying.value = false;
    }
  }
);
</script>
