<template>
  <div v-if="!hasFile" class="h-full w-full bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-8 relative">
    <div class="absolute top-0 left-0 right-0 h-12" data-window-drag></div>
    <div class="w-full max-w-xl text-center">
      <div class="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
        <Type :size="24" />
      </div>
      <div class="mt-4 text-xl font-semibold text-slate-900">预览字体</div>
      <div class="mt-2 text-sm text-slate-500 leading-relaxed">
        打开字体文件后可调整字号并自定义预览文本。
      </div>
      <div class="mt-5 flex items-center justify-center">
        <button
          type="button"
          class="h-10 px-5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 active:bg-emerald-800 transition-colors"
          @click="pickFile"
        >
          选择文件
        </button>
      </div>
      <div class="mt-3 text-xs text-slate-400">
        支持 .ttf / .otf / .woff / .woff2
      </div>
    </div>
  </div>

  <div v-else ref="rootRef" class="h-full w-full flex flex-col bg-white overflow-hidden relative">
    <div class="absolute top-0 left-0 right-0 h-12 z-20" data-window-drag></div>
    <div class="flex-1 min-h-0 relative p-8 pt-16 overflow-y-auto">
      <div v-if='loading' class="absolute inset-0 flex items-center justify-center bg-white z-10">
        <n-spin size="large" />
      </div>
      
      <div v-else-if='error' class="flex flex-col items-center justify-center h-full text-red-500 gap-2">
        <n-icon :size="32"><AlertCircle /></n-icon>
        <p>{{ error }}</p>
      </div>

      <div v-else class="space-y-8 max-w-4xl mx-auto">
        <div class="border border-gray-100 rounded-2xl bg-gray-50/50 flex items-center justify-center min-h-[200px] p-8">
          <p :style="{ fontFamily: fontName, fontSize: fontSize + 'px' }" class="text-gray-900 break-all text-center leading-tight transition-all duration-200">
            {{ previewText || defaultText }}
          </p>
        </div>

        <div class="grid gap-6 grid-cols-2">
           <div class="p-6 border border-gray-100 rounded-2xl">
             <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">{{ '大写字母' }}</h3>
             <p :style="{ fontFamily: fontName }" class="text-2xl break-all leading-relaxed text-gray-800">
               ABCDEFGHIJKLMNOPQRSTUVWXYZ
             </p>
           </div>
           <div class="p-6 border border-gray-100 rounded-2xl">
             <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">{{ '小写字母' }}</h3>
             <p :style="{ fontFamily: fontName }" class="text-2xl break-all leading-relaxed text-gray-800">
               abcdefghijklmnopqrstuvwxyz
             </p>
           </div>
           <div class="p-6 border border-gray-100 rounded-2xl">
             <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">{{ '数字' }}</h3>
             <p :style="{ fontFamily: fontName }" class="text-2xl break-all leading-relaxed text-gray-800">
               0123456789
             </p>
           </div>
           <div class="p-6 border border-gray-100 rounded-2xl">
             <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">{{ '符号' }}</h3>
             <p :style="{ fontFamily: fontName }" class="text-2xl break-all leading-relaxed text-gray-800">
              !@#$%^&*()_+-=[]{}|;:'",./&lt;&gt;?
             </p>
           </div>
        </div>
        
        <div class="space-y-4 border-t border-gray-100 pt-8">
           <p v-for="size in [12, 18, 24, 36, 48, 60]" :key='size' :style="{ fontFamily: fontName, fontSize: size + 'px' }" class="text-gray-900 truncate">
             {{ previewText || `${defaultText} (${size}px)` }}
           </p>
        </div>
      </div>
    </div>

    <div class="h-14 flex items-center justify-between bg-white flex-shrink-0 px-6 py-0 gap-4 border-t border-gray-100">
      <div class="flex items-center gap-4 min-w-0">
        <n-input
          v-model:value="previewText"
          type="text"
          :placeholder="'输入预览文本...'"
          class="w-64"
        />
        <div class="flex items-center gap-1 bg-gray-100 p-1 rounded-lg flex-shrink-0">
          <n-button
            @click="fontSize = Math.max(12, fontSize - 4)"
            quaternary
            size="tiny"
            :disabled="fontSize <= 12"
          >
            <template #icon><n-icon :size="16"><Minus /></n-icon></template>
          </n-button>
          <span class="w-8 text-center text-xs font-medium text-gray-600">{{ fontSize }}</span>
          <n-button
            @click="fontSize = Math.min(128, fontSize + 4)"
            quaternary
            size="tiny"
            :disabled="fontSize >= 128"
          >
            <template #icon><n-icon :size="16"><Plus /></n-icon></template>
          </n-button>
        </div>
      </div>

      <button
        class="h-9 w-9 rounded-xl flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-black/5"
        @click="toggleFullscreen"
        :title="isFullscreen ? `退出全屏` : `全屏`"
      >
        <Minimize2 v-if="isFullscreen" :size="18" />
        <Maximize2 v-else :size="18" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount, onMounted, computed, watch } from 'vue';
import { Minus, Plus, AlertCircle, Maximize2, Minimize2, Type } from 'lucide-vue-next';
import { NInput, NButton, NIcon, NSpin } from 'naive-ui';
import { reopenCurrentAppWindow, useOs } from '@/os';

const props = defineProps({
  files: { type: Array, default: () => [] },
  componentProps: { type: Object, default: () => ({}) }
});

const os = useOs();
const api = os.api;

const closeSelf = () => os.window.close();

const loading = ref(true);
const error = ref(null);
const fontName = ref('');
const fontSize = ref(48);
const previewText = ref('');
const defaultText = '敏捷的棕色狐狸跳过了懒狗';
const path = computed(() => props.files?.[0]?.path || '');
const hasFile = computed(() => !!path.value);
const url = computed(() => (path.value ? String(api.getFileUrl(path.value) || '') : ''));
const rootRef = ref(null);
const isFullscreen = ref(false);

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
    void 0;
  }
};

const pickFile = () => {
  os.stores.windows.openFileSelector?.((selectedFile) => {
    if (!selectedFile) return;

    reopenCurrentAppWindow(os, {
      title: selectedFile.name || selectedFile.path,
      componentProps: { files: [selectedFile] }
    });
    closeSelf();
  }, { allowedTypes: ['ttf', 'otf', 'woff', 'woff2', 'eot'] });
};

const loadFont = async () => {
  if (!url.value) return;
  loading.value = true;
  error.value = null;
  try {
    const fontFaceName = `font-${Date.now()}`;
    const font = new FontFace(fontFaceName, `url(${url.value})`);
    await font.load();
    document.fonts.add(font);
    fontName.value = fontFaceName;
  } catch (e) {
    error.value = '字体加载失败';
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  if (!hasFile.value) {
    loading.value = false;
    document.addEventListener('fullscreenchange', syncFullscreen);
    syncFullscreen();
    return;
  }
  try {
    await loadFont();
  } catch {
    void 0;
  }
  document.addEventListener('fullscreenchange', syncFullscreen);
  syncFullscreen();
});

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', syncFullscreen);
});

watch(() => url.value, (v) => {
  if (!v) return;
  loadFont();
});
</script>
