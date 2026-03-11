<template>
  <div class="h-full w-full">
    <div class="h-full flex flex-col bg-transparent">
      <div ref="scrollRef" class="flex-1 overflow-y-auto px-6 py-6 md:px-8 md:py-8">
        <div class="max-w-[880px] mx-auto space-y-10">
          <div class="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
            <div class="w-full sm:w-64 aspect-video rounded-xl overflow-hidden bg-gray-100 relative group shadow-sm ring-1 ring-gray-900/5 flex-shrink-0">
              <template v-if="currentWallpaperKind === 'video' && currentWallpaperUrl">
                <video class="w-full h-full object-cover" :src="currentWallpaperUrl" autoplay loop muted playsinline></video>
              </template>
              <img v-else-if="currentWallpaperUrl" :src="currentWallpaperUrl" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full flex items-center justify-center text-gray-300">
                <Image :size="32" stroke-width="1.5" />
              </div>
              <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <n-button text class="text-white hover:text-white" @click="clearWallpaper">{{ `清空` }}</n-button>
                <n-button text class="text-white hover:text-white" @click="resetWallpaper">{{ `重置` }}</n-button>
              </div>
            </div>

            <div class="flex-1 w-full space-y-5 pt-1">
              <div class="flex items-center justify-between gap-4">
                <span class="text-sm font-medium text-gray-700">{{ `模式` }}</span>
                <n-radio-group v-model:value="mode" size="small">
                  <n-radio-button value="slideshow">{{ `轮播` }}</n-radio-button>
                  <n-radio-button value="video">{{ `视频` }}</n-radio-button>
                </n-radio-group>
              </div>

              <div v-if="mode === 'video'" class="space-y-2">
                <div class="text-xs text-gray-500">{{ `视频壁纸 URL` }}</div>
                <n-input-group>
                  <n-input v-model:value="videoUrlDraft" :placeholder="`输入视频 URL`" @keyup.enter="applyVideoUrl" />
                  <n-button secondary @click="applyVideoUrl" :disabled="!videoUrlDraft.trim()">{{ `应用` }}</n-button>
                </n-input-group>
              </div>

              <div v-else class="space-y-3">
                <div class="flex items-center justify-between text-xs text-gray-500">
                  <span>{{ `轮播开关` }}</span>
                  <n-switch v-model:value="slideshowEnabled" size="small" @update:value="toggleSlideshowEnabled" />
                </div>
                <div class="flex justify-between text-xs text-gray-500">
                  <span>{{ `轮播间隔` }}</span>
                  <span>{{ Math.round(slideshowInterval / 1000) }}s</span>
                </div>
                <n-slider
                  v-model:value="slideshowInterval"
                  :min="1000"
                  :max="3600000"
                  :step="1000"
                  :disabled="!slideshowEnabled"
                  @update:value="saveSlideshowSettings"
                />
              </div>

              <div v-if="mode !== 'video'" class="pt-1 space-y-2">
                <div class="text-xs text-gray-500">{{ `添加到壁纸库` }}</div>
                <n-input-group>
                  <n-input v-model:value="newSlideUrl" :placeholder="`输入图片 URL`" @keyup.enter="addSlide" />
                  <n-button secondary @click="addSlide" :disabled="!newSlideUrl.trim()">{{ `添加` }}</n-button>
                  <n-button secondary @click="openMultilineImport('image')">{{ `批量导入` }}</n-button>
                  <n-button secondary @click="importFromFolder('image')">
                    <template #icon><FolderOpen :size="16" /></template>
                  </n-button>
                </n-input-group>
              </div>

              <div v-else class="pt-1 space-y-2">
                <div class="text-xs text-gray-500">{{ `添加到视频库` }}</div>
                <n-input-group>
                  <n-input v-model:value="newVideoUrl" :placeholder="`输入视频 URL`" @keyup.enter="addVideo" />
                  <n-button secondary @click="addVideo" :disabled="!newVideoUrl.trim()">{{ `添加` }}</n-button>
                  <n-button secondary @click="openMultilineImport('video')">{{ `批量导入` }}</n-button>
                  <n-button secondary @click="importFromFolder('video')">
                    <template #icon><FolderOpen :size="16" /></template>
                  </n-button>
                </n-input-group>
              </div>
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-6">
              <h3 class="font-bold text-gray-900 text-base">{{ mode === 'video' ? `视频库` : `壁纸库` }}</h3>
              <span class="text-xs text-gray-400 font-mono">{{ mode === 'video' ? videoVideos.length : slideshowImages.length }}</span>
            </div>

            <div
              v-if="mode !== 'video' && slideshowImages.length === 0"
              class="py-16 flex flex-col items-center justify-center text-gray-300 border-2 border-dashed border-gray-100 rounded-2xl"
            >
              <Image :size="48" class="mb-3 opacity-50" stroke-width="1" />
              <span class="text-sm">{{ `壁纸库为空` }}</span>
            </div>

            <div
              v-else-if="mode === 'video' && videoVideos.length === 0"
              class="py-16 flex flex-col items-center justify-center text-gray-300 border-2 border-dashed border-gray-100 rounded-2xl"
            >
              <Image :size="48" class="mb-3 opacity-50" stroke-width="1" />
              <span class="text-sm">{{ `视频库为空` }}</span>
            </div>

            <div v-else-if="mode !== 'video'" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              <div
                v-for="(img, index) in visibleSlideshowImages"
                :key="img"
                class="group relative aspect-video rounded-lg overflow-hidden bg-gray-50 cursor-pointer ring-1 ring-gray-900/5 transition-all hover:shadow-md"
                :class="{ 'ring-2 ring-blue-500 ring-offset-2': fixedUrl === img }"
                @click="setAsFixed(img)"
              >
                <img
                  :src="img"
                  class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />

                <div class="absolute inset-0 bg-black/0 sm:group-hover:bg-black/20 transition-colors"></div>

                <div class="absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex gap-2">
                  <button
                    class="w-6 h-6 rounded-full bg-white/90 text-gray-600 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-colors shadow-sm"
                    @click.stop="setAsFixed(img)"
                    :title="`设为当前壁纸`"
                  >
                    <Monitor :size="12" />
                  </button>
                  <button
                    class="w-6 h-6 rounded-full bg-white/90 text-gray-600 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors shadow-sm"
                    @click.stop="removeSlide(index)"
                    :title="`移除`"
                  >
                    <Trash2 :size="12" />
                  </button>
                </div>

                <div v-if="fixedUrl === img" class="absolute bottom-2 right-2 bg-blue-500 rounded-full p-1 shadow-sm">
                  <Check :size="10" class="text-white" />
                </div>
              </div>
            </div>

            <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              <div
                v-for="(vid, index) in visibleVideoVideos"
                :key="vid"
                class="group relative aspect-video rounded-lg overflow-hidden bg-gray-50 cursor-pointer ring-1 ring-gray-900/5 transition-all hover:shadow-md"
                :class="{ 'ring-2 ring-blue-500 ring-offset-2': mode === 'video' && videoUrl === vid }"
                @click="mode === 'video' && setAsVideo(vid)"
                @mouseenter="hoveredVideoIndex = index"
                @mouseleave="hoveredVideoIndex = -1"
              >
                <div class="absolute inset-0 bg-gray-100 flex items-center justify-center">
                  <Image :size="28" class="text-gray-300" stroke-width="1.5" />
                </div>
                <video
                  v-if="hoveredVideoIndex === index"
                  class="absolute inset-0 w-full h-full object-cover"
                  :src="vid"
                  autoplay
                  loop
                  muted
                  playsinline
                  preload="auto"
                />

                <div class="absolute inset-0 bg-black/0 sm:group-hover:bg-black/20 transition-colors"></div>

                <div class="absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex gap-2">
                  <button
                    class="w-6 h-6 rounded-full bg-white/90 text-gray-600 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-colors shadow-sm"
                    @click.stop="setAsVideo(vid)"
                    :title="`设为视频壁纸`"
                  >
                    <Monitor :size="12" />
                  </button>
                  <button
                    class="w-6 h-6 rounded-full bg-white/90 text-gray-600 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors shadow-sm"
                    @click.stop="removeVideo(index)"
                    :title="`移除`"
                  >
                    <Trash2 :size="12" />
                  </button>
                </div>

                <div v-if="mode === 'video' && videoUrl === vid" class="absolute bottom-2 right-2 bg-blue-500 rounded-full p-1 shadow-sm">
                  <Check :size="10" class="text-white" />
                </div>
              </div>
            </div>

            <div v-if="canLoadMore" class="mt-4 flex items-center justify-center">
              <n-button secondary @click="loadMore">{{ `加载更多` }}</n-button>
            </div>
            <div ref="loadMoreRef" class="h-1"></div>
          </div>
        </div>
      </div>
    </div>

    <n-modal v-model:show="multilineImportVisible" preset="card" :title="multilineImportTarget === 'video' ? `批量导入视频` : `批量导入壁纸`" class="w-[92vw] max-w-[720px]">
       <div class="space-y-3">
          <n-input
            v-model:value="multilineImportText"
            type="textarea"
            :placeholder="`每行输入一个 URL`"
            :autosize="{ minRows: 8, maxRows: 16 }"
          />
          <div class="flex justify-end gap-2">
             <n-button @click="multilineImportVisible = false">{{ `取消` }}</n-button>
             <n-button type="primary" @click="applyMultilineImport" :disabled="!multilineImportText.trim()">{{ `导入` }}</n-button>
          </div>
       </div>
    </n-modal>
  </div>
</template>

<script setup>
import { computed, ref, onBeforeUnmount, onMounted, watch } from 'vue';
import { Trash2, Monitor, FolderOpen, Image, Check } from 'lucide-vue-next';
import { FILE_EXTENSIONS, useOs } from '@/os';

const os = useOs();
const api = os.api;

const toast = os.ui.toast;

const { requestSiteInfoRefresh, currentWallpaperUrl, currentWallpaperKind } = os.stores.system;

const getExt = (name) => {
  const fileName = String(name || '');
  const lastDot = fileName.lastIndexOf('.');
  return lastDot > 0 ? fileName.slice(lastDot + 1).toLowerCase() : '';
};

const uniqueStrings = (arr) => {
  const out = [];
  const seen = new Set();
  (Array.isArray(arr) ? arr : []).forEach((v) => {
    const s = String(v || '').trim();
    if (!s) return;
    if (seen.has(s)) return;
    seen.add(s);
    out.push(s);
  });
  return out;
};

const IMAGE_EXTENSIONS = FILE_EXTENSIONS.IMAGE;
const VIDEO_EXTENSIONS = FILE_EXTENSIONS.VIDEO;

const mode = ref('slideshow');
const fixedUrl = ref('');
const videoUrl = ref('');
const videoUrlDraft = ref('');
const slideshowInterval = ref(60000);
const slideshowEnabled = ref(true);
const slideshowImages = ref([]);
const newSlideUrl = ref('');
const videoVideos = ref([]);
const newVideoUrl = ref('');
const userWallpaper = ref('');
const wallpaperEnabled = ref(true);
const multilineImportVisible = ref(false);
const multilineImportText = ref('');
const multilineImportTarget = ref('image');
const initialized = ref(false);
const suppressNextModeSave = ref(false);
const hoveredVideoIndex = ref(-1);
let saveSeq = 0;

const PAGE_SIZE = 48;
const renderedCount = ref(PAGE_SIZE);
const scrollRef = ref(null);
const loadMoreRef = ref(null);
let loadMoreObserver = null;

const activeLibraryList = computed(() => {
  return mode.value === 'video' ? videoVideos.value : slideshowImages.value;
});

const canLoadMore = computed(() => {
  return renderedCount.value < activeLibraryList.value.length;
});

const visibleSlideshowImages = computed(() => {
  return slideshowImages.value.slice(0, renderedCount.value);
});

const visibleVideoVideos = computed(() => {
  return videoVideos.value.slice(0, renderedCount.value);
});

const loadMore = () => {
  renderedCount.value = Math.min(activeLibraryList.value.length, renderedCount.value + PAGE_SIZE);
};

watch(
  mode,
  () => {
    if (!initialized.value) return;
    if (suppressNextModeSave.value) {
      suppressNextModeSave.value = false;
      return;
    }
    if (mode.value === 'video' && videoUrlDraft.value.trim() !== videoUrl.value) {
      videoUrl.value = videoUrlDraft.value.trim();
    }
    saveConfig(createConfig());
  }
);

watch(
  () => [mode.value, slideshowImages.value.length, videoVideos.value.length],
  () => {
    hoveredVideoIndex.value = -1;
    renderedCount.value = PAGE_SIZE;
  }
);

const parseSettings = () => {
  const raw = userWallpaper.value;
  if (!raw) {
    mode.value = 'slideshow';
    fixedUrl.value = '';
    videoUrl.value = '';
    videoUrlDraft.value = '';
    slideshowInterval.value = 60000;
    slideshowImages.value = [];
    videoVideos.value = [];
    wallpaperEnabled.value = false;
    slideshowEnabled.value = true;
    return;
  }

  try {
    const config = JSON.parse(raw);
    if (!config || typeof config !== 'object') {
      throw new Error('invalid wallpaper config');
    }
    const parsedMode = String(config?.mode || '').toLowerCase();
    mode.value = parsedMode === 'video' ? 'video' : 'slideshow';
    fixedUrl.value = String(config.fixedUrl || '');
    videoUrl.value = String(config.videoUrl || '');
    videoUrlDraft.value = videoUrl.value;
    wallpaperEnabled.value = config.enabled !== false;

    const intervalRaw = config.slideshowInterval ?? 60000;
    const interval = Number(intervalRaw);
    slideshowEnabled.value = Number.isFinite(interval) && interval > 0;
    slideshowInterval.value = slideshowEnabled.value ? Math.max(1000, interval) : 60000;

    const images = Array.isArray(config.images) ? config.images : [];
    slideshowImages.value = uniqueStrings(images);
    if (!slideshowImages.value.includes(fixedUrl.value)) {
      fixedUrl.value = slideshowImages.value[0] || '';
    }

    const videos = Array.isArray(config.videos) ? config.videos : [];
    videoVideos.value = uniqueStrings(videos);
    if (mode.value === 'video' && !videoUrl.value && videoVideos.value.length > 0) {
      videoUrl.value = videoVideos.value[0];
      videoUrlDraft.value = videoUrl.value;
    }
  } catch (e) {
    mode.value = 'slideshow';
    fixedUrl.value = '';
    videoUrl.value = '';
    videoUrlDraft.value = '';
    videoVideos.value = [];
    slideshowImages.value = [];
    wallpaperEnabled.value = false;
    slideshowEnabled.value = true;
  }
};

const createConfig = () => {
  return {
    mode: mode.value,
    fixedUrl: fixedUrl.value,
    videoUrl: videoUrl.value,
    enabled: wallpaperEnabled.value,
    slideshowInterval: slideshowEnabled.value ? slideshowInterval.value : 0,
    images: slideshowImages.value,
    videos: videoVideos.value
  };
};

const saveWallpaperRaw = async (raw) => {
  const seq = ++saveSeq;
  try {
    const data = await api.updateProfile({ wallpaper: raw });
    if (seq !== saveSeq) return true;
    if (!data) throw new Error('save failed');
    userWallpaper.value = String(raw || '');
    requestSiteInfoRefresh();
    return true;
  } catch (err) {
    if (seq !== saveSeq) return false;
    toast.error(`保存壁纸设置失败`);
    return false;
  }
};

const saveConfig = async (config) => {
  const seq = ++saveSeq;
  try {
    const json = JSON.stringify(config);
    const data = await api.updateProfile({ wallpaper: json });
    if (seq !== saveSeq) return true;
    if (!data) throw new Error('save failed');
    userWallpaper.value = json;
    requestSiteInfoRefresh();
    return true;
  } catch (err) {
    if (seq !== saveSeq) return false;
    toast.error(`保存壁纸设置失败`);
    return false;
  }
};

const addSlide = () => {
  const url = String(newSlideUrl.value || '').trim();
  if (!url) return;
  if (slideshowImages.value.includes(url)) {
    toast.warning(`壁纸已在列表中`);
    return;
  }
  slideshowImages.value.push(url);
  if (!fixedUrl.value) {
    fixedUrl.value = url;
  }
  if (!wallpaperEnabled.value) {
    wallpaperEnabled.value = true;
  }
  newSlideUrl.value = '';
  saveConfig(createConfig());
};

const addVideo = () => {
  const url = String(newVideoUrl.value || '').trim();
  if (!url) return;
  if (videoVideos.value.includes(url)) {
    toast.warning(`视频已在列表中`);
    return;
  }
  videoVideos.value.push(url);
  if (!wallpaperEnabled.value) {
    wallpaperEnabled.value = true;
  }
  newVideoUrl.value = '';
  saveConfig(createConfig());
};

const applyVideoUrl = () => {
  const url = String(videoUrlDraft.value || '').trim();
  videoUrl.value = url;
  suppressNextModeSave.value = true;
  mode.value = 'video';
  wallpaperEnabled.value = true;
  saveConfig(createConfig());
};

const openMultilineImport = (target) => {
  multilineImportTarget.value = target === 'video' ? 'video' : 'image';
  multilineImportText.value = '';
  multilineImportVisible.value = true;
};

const parseMultilineUrls = (raw, existing) => {
  const lines = String(raw || '')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const out = [];
  const seen = new Set(existing || []);
  lines.forEach((line) => {
    const url = line;
    if (seen.has(url)) return;
    seen.add(url);
    out.push(url);
  });
  return out;
};

const applyMultilineImport = () => {
  const target = multilineImportTarget.value === 'video' ? 'video' : 'image';
  const urls = parseMultilineUrls(multilineImportText.value, target === 'video' ? videoVideos.value : slideshowImages.value);
  if (!urls.length) {
    toast.info(`没有检测到新的 URL`);
    return;
  }
  if (target === 'video') {
    videoVideos.value.push(...urls);
  } else {
    slideshowImages.value.push(...urls);
  }
  multilineImportVisible.value = false;
  multilineImportText.value = '';
  saveConfig(createConfig());
  toast.success(`导入成功`);
};

const removeSlide = (index) => {
  slideshowImages.value.splice(index, 1);
  saveConfig(createConfig());
};

const removeVideo = (index) => {
  const current = videoVideos.value[index];
  videoVideos.value.splice(index, 1);
  if (mode.value === 'video' && current && current === videoUrl.value) {
    videoUrl.value = '';
    videoUrlDraft.value = '';
  }
  saveConfig(createConfig());
};

const setAsFixed = (url) => {
  suppressNextModeSave.value = true;
  mode.value = 'slideshow';
  fixedUrl.value = url;
  wallpaperEnabled.value = true;
  saveConfig(createConfig());
};

const setAsVideo = (url) => {
  suppressNextModeSave.value = true;
  mode.value = 'video';
  videoUrl.value = url;
  videoUrlDraft.value = url;
  wallpaperEnabled.value = true;
  saveConfig(createConfig());
};

const clearWallpaper = () => {
  suppressNextModeSave.value = true;
  mode.value = 'slideshow';
  fixedUrl.value = '';
  videoUrl.value = '';
  videoUrlDraft.value = '';
  wallpaperEnabled.value = false;
  saveConfig(createConfig());
};

const resetWallpaper = async () => {
  const confirmed = await os.ui.dialog.confirm('确定要重置壁纸吗？');
  if (confirmed) {
    suppressNextModeSave.value = true;
    mode.value = 'slideshow';
    fixedUrl.value = '';
    videoUrl.value = '';
    videoUrlDraft.value = '';
    slideshowInterval.value = 60000;
    slideshowImages.value = [];
    videoVideos.value = [];
    wallpaperEnabled.value = false;
    saveWallpaperRaw('');
  }
};

const importFromFolder = (target) => {
  multilineImportTarget.value = target === 'video' ? 'video' : 'image';
  os.stores.windows.openFileSelector?.((files) => {
    if (!files) return;
    const file = Array.isArray(files) ? files[0] : files;
    if (file && file.type === 'directory') {
      importDirectory(file.path, multilineImportTarget.value);
    } else {
      toast.error('请选择文件夹');
    }
  }, { selectDirectory: true });
};

const importDirectory = async (path, target) => {
  try {
    const files = await api.getList(path);
    if (!Array.isArray(files)) return;

    const kind = target === 'video' ? 'video' : 'image';
    const extensions = kind === 'video' ? VIDEO_EXTENSIONS : IMAGE_EXTENSIONS;
    const label = kind === 'video' ? '视频' : '图片';
    const items = files
      .filter((f) => !f.isDirectory && extensions.has(getExt(f.name)))
      .map((f) => api.getFileUrl(f.path));
    
    if (items.length === 0) {
      toast.warning(`文件夹中没有${label}`);
      return;
    }
    
    let added = 0;
    const list = kind === 'video' ? videoVideos.value : slideshowImages.value;
    const seen = new Set(list);
    items.forEach((url) => {
      if (!seen.has(url)) {
        list.push(url);
        added++;
      }
    });
    
    if (added > 0) {
      saveConfig(createConfig());
      toast.success(`导入了 ${added} 个${label}`);
    } else {
      toast.info(`所有${label}已存在`);
    }
  } catch (err) {
    toast.error('导入失败');
  }
};

const saveSlideshowSettings = () => {
  if (!slideshowEnabled.value) return;
  saveConfig(createConfig());
};

const toggleSlideshowEnabled = (value) => {
  slideshowEnabled.value = !!value;
  if (slideshowEnabled.value && slideshowInterval.value <= 0) {
    slideshowInterval.value = 60000;
  }
  saveConfig(createConfig());
};

onMounted(async () => {
  const user = os.stores.auth.user;
  if (user && user.wallpaper) {
    userWallpaper.value = user.wallpaper;
  } else {
    try {
      const data = await api.getMe();
      userWallpaper.value = data?.wallpaper || '';
    } catch {
      void 0;
    }
  }
  parseSettings();
  initialized.value = true;

  const root = scrollRef.value;
  const target = loadMoreRef.value;
  if (root && target && typeof IntersectionObserver !== 'undefined') {
    loadMoreObserver = new IntersectionObserver(
      (entries) => {
        if (!entries?.length) return;
        if (!entries[0].isIntersecting) return;
        if (!canLoadMore.value) return;
        loadMore();
      },
      { root, threshold: 0.1 }
    );
    loadMoreObserver.observe(target);
  }
});

onBeforeUnmount(() => {
  if (loadMoreObserver) {
    try { loadMoreObserver.disconnect(); } catch { void 0; }
    loadMoreObserver = null;
  }
});
</script>
