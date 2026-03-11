<template>
  <div class="h-full flex flex-col bg-white overflow-hidden relative">
    <div class="absolute top-0 left-0 right-0 h-12 z-20" data-window-drag></div>
    <n-layout class="h-full">
      <!-- Header Removed for Simplicity -->
      
      <!-- Content -->
      <n-layout-content content-style="padding: 16px; padding-top: 48px;" :native-scrollbar="false">
        <div v-if="!hasFile" class="h-full w-full bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-8">
          <div class="w-full max-w-xl text-center">
            <div class="mx-auto w-14 h-14 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Info :size="24" />
            </div>
            <div class="mt-4 text-xl font-semibold text-slate-900">查看文件属性</div>
            <div class="mt-2 text-sm text-slate-500 leading-relaxed">
              选择一个文件以查看大小、类型、MIME、创建与修改时间等信息。
            </div>
            <div class="mt-5 flex items-center justify-center">
              <button
                type="button"
                class="h-10 px-5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-black active:bg-black transition-colors"
                @click="pickFile"
              >
                选择文件
              </button>
            </div>
            <div class="mt-3 text-xs text-slate-400">
              也可以从文件管理器右键 → 属性。
            </div>
          </div>
        </div>

        <div v-else-if='loading' class="flex justify-center items-center h-full">
           <n-spin size="large" />
        </div>
        
        <div v-else-if='error' class="flex flex-col items-center justify-center h-full">
           <n-result status='error' :title='error' />
        </div>

        <div v-else-if="data">
           <n-descriptions bordered size="small" :column="1" label-placement="left" :label-style="{ width: '100px' }">
             <n-descriptions-item :label="'名称'">
               {{ data.name }}
             </n-descriptions-item>
             <n-descriptions-item :label="'type'">
               {{ data.type }}
             </n-descriptions-item>
             <n-descriptions-item :label="'大小'">
               {{ formatSize(data.size) }}
             </n-descriptions-item>
             <n-descriptions-item :label="`MIME 类型`">
               {{ data.mimeType }}
             </n-descriptions-item>
             <n-descriptions-item :label="`创建时间`">
               {{ new Date(data.created).toLocaleDateString() }} {{ new Date(data.created).toLocaleTimeString() }}
             </n-descriptions-item>
             <n-descriptions-item :label="`修改时间`">
               {{ new Date(data.modified).toLocaleDateString() }} {{ new Date(data.modified).toLocaleTimeString() }}
             </n-descriptions-item>
             <n-descriptions-item :label="'location'">
      <n-text code class="break-all">{{ data.path }}</n-text>
    </n-descriptions-item>
           </n-descriptions>
        </div>
      </n-layout-content>
    </n-layout>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { 
  NLayout, NLayoutContent, 
  NSpin, NResult, NDescriptions, NDescriptionsItem, NText
} from 'naive-ui';
import { Info } from 'lucide-vue-next';
import { reopenCurrentAppWindow, useOs } from '@/os';

const props = defineProps({
  files: { type: Array, default: () => [] },
  componentProps: { type: Object, default: () => ({}) }
});
const os = useOs();
const api = os.api;

const loading = ref(true);
const error = ref('');
const data = ref(null);
const path = computed(() => props.files?.[0]?.path || '');
const hasFile = computed(() => !!path.value);

const closeWindow = () => {
  os.window.close();
};

const pickFile = () => {
  os.stores.windows.openFileSelector?.((selectedFile) => {
    if (!selectedFile) return;

    reopenCurrentAppWindow(os, {
      title: selectedFile.name || selectedFile.path,
      componentProps: { files: [selectedFile] }
    });
    closeWindow();
  });
};

const formatSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const loadProperties = async () => {
  if (!path.value) return;
  loading.value = true;
  error.value = '';
  try {
    const stat = await api.getFileStat(path.value);
    data.value = stat;
  } catch (err) {
    error.value = `加载属性失败: ${err.message || err}`;
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  if (!hasFile.value) loading.value = false;
});

watch(path, (p) => {
  if (!p) {
    loading.value = false;
    error.value = '';
    data.value = null;
    return;
  }
  loadProperties();
}, { immediate: true });
</script>
