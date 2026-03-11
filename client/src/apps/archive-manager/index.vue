<template>
  <div class="h-full flex flex-col bg-white relative">
    <div class="absolute top-0 left-0 right-0 h-12" data-window-drag></div>

    <div v-if="mode === 'invalid'" class="flex-1 flex flex-col items-center justify-center pt-12" :class="contentPaddingClass">
      <n-empty :description="`请选择一个压缩包进行解压，或选择文件进行压缩`">
        <template #extra>
          <n-button type="primary" @click="pickFile">
            {{ `选择文件` }}
          </n-button>
        </template>
      </n-empty>
    </div>

    <!-- Mode: Extract -->
    <div v-else-if="mode === 'extract'" class="flex-1 flex flex-col pt-12" :class="contentPaddingClass">
      <div class="flex items-center gap-4 mb-6">
        <div class="p-4 bg-orange-100 text-orange-600 rounded-xl">
          <n-icon :size="32"><ArchiveIcon /></n-icon>
        </div>
        <div>
          <h3 class="text-lg font-bold text-gray-900">解压文件</h3>
          <p class="text-sm text-gray-500">{{ formatSize(extractSize) }}</p>
        </div>
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">解压到</label>
          <div class="flex items-center gap-2">
            <n-input 
              v-model:value="destinationName" 
              placeholder="文件夹名称"
              class="flex-1"
            />
          </div>
          <p class="text-xs text-gray-500 mt-1">文件将被解压到当前目录下的此文件夹中</p>
        </div>
      </div>

      <div class="mt-auto pt-6 flex justify-end">
        <n-button 
          type="primary"
          @click="handleExtract"
          :loading='loading'
          :disabled='loading'
          size="large"
        >
          <template #icon v-if='loading'><n-icon><Loader2 class="animate-spin" /></n-icon></template>
          {{ loading ? 'processing' : `解压` }}
        </n-button>
      </div>
    </div>

    <!-- Mode: Compress -->
    <div v-else class="flex-1 flex flex-col overflow-hidden pt-12" :class="contentPaddingClass">
      <div class="mb-6">
        <h3 class="text-lg font-bold text-gray-900 flex items-center gap-2">
          <n-icon :size="20" class="text-blue-500"><ArchiveIcon /></n-icon>
          压缩文件
        </h3>
        <p class="text-sm text-gray-500 mt-1">{{ `已选择 ${count} 个文件` }}</p>
      </div>

      <div class="flex-1 overflow-y-auto bg-gray-50 rounded-xl border border-gray-100 p-2 mb-4">
        <div v-for="f in targetFiles" :key="f.path" class="flex items-center gap-3 p-2 hover:bg-white rounded-lg transition-colors">
          <n-icon :size="16" class="text-gray-400"><FileText /></n-icon>
          <span class="text-sm text-gray-700 truncate">{{ f.name }}</span>
        </div>
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">压缩包名称</label>
          <div class="relative">
            <n-input 
              v-model:value="archiveName" 
              placeholder="输入名称"
            >
              <template #suffix>.zip</template>
            </n-input>
          </div>
        </div>
      </div>

      <div class="mt-6 flex justify-end">
        <n-button 
          type="primary"
          @click="handleCompress"
          :loading='loading'
          :disabled="loading || !archiveName"
          size="large"
        >
          <template #icon v-if='loading'><n-icon><Loader2 class="animate-spin" /></n-icon></template>
          {{ loading ? 'processing' : '压缩' }}
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { Archive as ArchiveIcon, FileText, Loader2 } from 'lucide-vue-next';
import { NInput, NButton, NIcon, NEmpty } from 'naive-ui';
import { reopenCurrentAppWindow, useOs } from '@/os';

const props = defineProps({
  files: { type: Array, required: true },
  componentProps: { type: Object, default: () => ({}) }
});

const os = useOs();

const api = os.api;
const { toast } = os.ui;
const windowWidth = computed(() => os.window.data?.width ?? window.innerWidth);
const closeSelf = () => os.window.close();

const loading = ref(false);
const destinationName = ref('');
const archiveName = ref('');
const extractSize = ref(0);

const baseName = (p) => String(p || '').split('/').filter(Boolean).pop() || '';

const isArchivePath = (p) => {
  const name = baseName(p);
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  return ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext);
};

const targetFiles = computed(() => {
  return (Array.isArray(props.files) ? props.files : [])
    .map((f) => ({ path: f?.path || '', name: baseName(f?.path || '') }))
    .filter((f) => !!f.path);
});

const mode = computed(() => {
  if (targetFiles.value.length === 0) return 'invalid';
  if (targetFiles.value.length === 1 && isArchivePath(targetFiles.value[0].path)) return 'extract';
  return 'compress';
});

const contentPaddingClass = computed(() => {
  const w = windowWidth.value;
  return w >= 768 ? 'p-6' : 'p-4';
});

const pickFile = () => {
  os.stores.windows.openFileSelector?.((selectedFile) => {
    if (!selectedFile) return;

    reopenCurrentAppWindow(os, {
      title: selectedFile.name,
      componentProps: { files: [selectedFile] }
    });
    closeSelf();
  });
};

onMounted(() => {
  if (mode.value === 'extract') {
    const name = targetFiles.value[0]?.name || '';
    const lastDot = name.lastIndexOf('.');
    destinationName.value = lastDot > 0 ? name.substring(0, lastDot) : name + '_extracted';
  } else if (mode.value === 'compress') {
    if (targetFiles.value.length > 0) {
        // Default archive name = first file name
        const first = targetFiles.value[0];
        const name = first.name;
        const lastDot = name.lastIndexOf('.');
        archiveName.value = lastDot > 0 ? name.substring(0, lastDot) : name;
    }
  }
});

const formatSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const handleExtract = async () => {
  const path = targetFiles.value[0]?.path || '';
  if (!path) return;
  
  loading.value = true;
  try {
    const parentDir = path.substring(0, path.lastIndexOf('/'));
    const destPath = (parentDir ? parentDir + '/' : '') + destinationName.value;
    
    await api.extractFile(path, destPath);
    os.files.triggerRefresh?.();
    toast.success?.(`解压成功`);
    closeSelf();
  } catch (err) {
    toast.error?.(`解压失败: ${err.message || '未知错误'}`);
  } finally {
    loading.value = false;
  }
};

const handleCompress = async () => {
  if (!targetFiles.value || targetFiles.value.length === 0) return;
  
  loading.value = true;
  try {
    const firstFile = targetFiles.value[0];
    const parentPath = firstFile.path.substring(0, firstFile.path.lastIndexOf('/')) || '/';
    
    const filePaths = targetFiles.value.map(f => f.path);
    const finalArchiveName = archiveName.value.endsWith('.zip') ? archiveName.value : archiveName.value + '.zip';
    
    await api.compressFiles(filePaths, finalArchiveName, parentPath);
    os.files.triggerRefresh?.();
    toast.success?.(`压缩成功`);
    closeSelf();
  } catch (err) {
    toast.error?.(`压缩失败: ${err.message || '未知错误'}`);
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  if (mode.value !== 'extract') return;
  const path = targetFiles.value[0]?.path || '';
  if (!path) return;
  try {
    const stat = await api.getFileStat(path);
    extractSize.value = Number(stat?.size || 0);
  } catch {
    extractSize.value = 0;
  }
});
</script>
