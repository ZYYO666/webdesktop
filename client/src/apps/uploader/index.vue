<template>
  <div class="h-full w-full flex flex-col bg-white text-slate-800 relative">
    <n-layout has-sider class="h-full w-full bg-transparent">
      <!-- Sidebar -->
      <n-layout-sider
        collapse-mode="transform"
        :collapsed-width="0"
        :width="220"
        class="bg-gray-50 h-full border-r border-gray-100"
      >
        <div class="h-full flex flex-col pt-4 pb-4 overflow-y-auto select-none">
          <div class="shrink-0 h-12 -mt-4 mb-2" data-window-drag></div>
          
          <div class="mb-4">
            <div class="px-4 py-1.5 text-[12px] font-bold text-gray-400/80 uppercase tracking-wide">任务</div>
            <div class="px-2 space-y-1.5">
              <button 
                class="group w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all cursor-default relative bg-blue-600 text-white shadow-sm"
              >
                <UploadCloud :size="15" stroke-width="2" class="text-white" />
                <span class="truncate relative z-10">上传列表</span>
                <span v-if="queue.length > 0" class="ml-auto text-[11px] font-medium text-white/90">
                  {{ completedCount }}/{{ queue.length }}
                </span>
              </button>
            </div>
          </div>
        </div>
      </n-layout-sider>

      <!-- Main Content -->
      <n-layout class="h-full bg-transparent flex flex-col min-w-0" 
        @dragover.prevent="isDragOver = true" 
        @dragleave.prevent="isDragOver = false"
        @drop.prevent="handleDrop"
      >
        <!-- Drop Overlay -->
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div 
            v-if="isDragOver" 
            class="absolute inset-2 z-50 bg-blue-50/90 backdrop-blur-sm flex items-center justify-center border-2 border-blue-400 border-dashed rounded-2xl pointer-events-none"
          >
            <div class="flex flex-col items-center motion-safe:animate-bounce">
              <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 text-blue-600">
                <n-icon size="32"><UploadCloud /></n-icon>
              </div>
              <span class="text-blue-600 font-medium text-lg tracking-tight">释放以添加文件</span>
            </div>
          </div>
        </Transition>

        <!-- Header -->
        <div class="h-12 shrink-0 flex items-center justify-between px-6 bg-white/80 backdrop-blur-xl border-b border-gray-100 z-20 absolute top-0 left-0 right-0 pr-32" data-window-drag>
          <div class="flex items-center gap-4 min-w-0 flex-1">
            <p class="text-xs text-gray-500 truncate max-w-[200px]" :title="uploadPath">
              上传到: {{ uploadPath }}
            </p>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <button 
              @click="triggerFileSelection"
              class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm active:scale-95"
            >
              <Plus :size="14" />
              <span>添加文件</span>
            </button>
          </div>
        </div>

        <!-- List -->
        <div class="flex-1 overflow-y-auto p-6 pt-16 bg-white" :native-scrollbar="false">
          <div v-if="queue.length === 0" class="h-full flex flex-col items-center justify-center text-gray-400 pb-10">
            <div class="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-gray-100">
              <UploadCloud class="w-10 h-10 text-gray-300" stroke-width="1.5" />
            </div>
            <h3 class="text-gray-900 font-bold text-base mb-2">准备就绪</h3>
            <p class="text-sm text-gray-400 mb-6 text-center max-w-[200px] leading-relaxed">拖拽文件到这里<br>或点击按钮开始上传</p>
            <button 
              @click="triggerFileSelection"
              class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm shadow-blue-200"
            >
              选择文件
            </button>
          </div>

          <TransitionGroup
            tag="div" 
            class="flex flex-col gap-3 pb-4"
            move-class="transition duration-300 ease-out"
            enter-active-class="transition duration-300 ease-out"
            leave-active-class="absolute w-full transition duration-300 ease-out"
            enter-from-class="opacity-0 translate-y-2.5"
            leave-to-class="opacity-0 translate-y-2.5"
          >
            <div 
              v-for="item in queue" 
              :key="item.id"
              class="group relative bg-white border border-gray-100 rounded-xl p-3 pl-4 flex items-center gap-4 hover:shadow-sm hover:border-gray-200 transition-all duration-300 ease-out overflow-hidden"
              :class="{ 'border-red-100 bg-red-50/5': item.status === 'error' }"
            >
              <!-- Progress Bar Background (Bottom) -->
              <div 
                v-if="item.status === 'uploading'"
                class="absolute bottom-0 left-0 h-[2px] bg-blue-500 transition-all duration-300 ease-out z-0"
                :style="{ width: item.progress + '%' }"
              ></div>

              <!-- Icon -->
              <div class="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 text-gray-400 relative z-10 border border-gray-100">
                 <n-icon v-if="item.status === 'error'" class="text-red-500"><AlertCircle /></n-icon>
                 <n-icon v-else size="20"><FileText /></n-icon>
                 
                 <!-- Success Badge -->
                 <div v-if="item.status === 'success'" class="absolute -bottom-1 -right-1 bg-green-500 text-white rounded-full p-[2px] border-2 border-white flex items-center justify-center shadow-sm">
                   <n-icon size="8" stroke-width="4"><Check /></n-icon>
                 </div>
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0 z-10 flex flex-col justify-center h-full gap-0.5">
                <div class="flex items-center justify-between">
                  <span class="text-[13px] font-medium text-gray-900 truncate pr-2" :title="item.file.name">{{ item.file.name }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span v-if="item.status === 'error'" class="text-xs text-red-500 truncate">{{ item.error || '上传失败' }}</span>
                  <span v-else class="text-xs text-gray-400 font-mono flex items-center gap-2">
                    {{ formatSize(item.file.size) }}
                    <span v-if="item.status === 'uploading'" class="text-blue-500 font-sans font-medium">{{ item.progress }}%</span>
                    <span v-if="item.status === 'pending'" class="text-gray-300 font-sans">等待中</span>
                  </span>
                </div>
              </div>

              <!-- Action / Status Indicator -->
              <div class="shrink-0 z-10 pr-1 flex items-center">
                 <button 
                    v-if="['uploading', 'pending'].includes(item.status)"
                    @click="cancelUpload(item)"
                    class="w-7 h-7 rounded-full flex items-center justify-center text-gray-300 hover:bg-gray-100 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100"
                    title="取消"
                 >
                    <n-icon size="14"><X /></n-icon>
                 </button>
                 <div v-else-if="item.status === 'success'" class="w-7 h-7 flex items-center justify-center text-green-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <!-- Placeholder/Action if needed -->
                 </div>
              </div>
            </div>
          </TransitionGroup>
        </div>
      </n-layout>
    </n-layout>

    <input ref="fileInput" type="file" multiple class="hidden" @change="handleFileInputChange" />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { 
  FileText, X, UploadCloud, Plus, AlertCircle, Check
} from 'lucide-vue-next';
import { useOs } from '@/os';

const props = defineProps({
  files: { type: Array, required: true },
  autoOpenSelect: { type: Boolean, default: false }
});

const os = useOs();
const api = os.api;
const emit = defineEmits(['close-window', 'upload-success']);
const queue = ref([]);
const isUploading = ref(false);
const fileInput = ref(null);
const isDragOver = ref(false);

const uploadPath = computed(() => props.files?.[0]?.path || '/');

const triggerGlobalRefresh = () => {
  os.files.triggerRefresh();
};

const completedCount = computed(() => queue.value.filter(i => i.status === 'success').length);

const formatSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const addFilesToQueue = (fileList) => {
  isDragOver.value = false;
  if (!fileList?.length) return;
  const items = Array.from(fileList).map(file => ({
    id: Math.random().toString(36).substr(2, 9),
    file, status: 'pending', progress: 0, path: uploadPath.value
  }));
  queue.value.push(...items);
  processQueue();
};

const triggerFileSelection = () => fileInput.value?.click();
const handleFileInputChange = (e) => { addFilesToQueue(e.target.files); e.target.value = ''; };
const handleDrop = (e) => addFilesToQueue(e.dataTransfer.files);

const processQueue = async () => {
  if (isUploading.value) return;
  const pending = queue.value.find(i => i.status === 'pending');
  if (!pending) {
    if (completedCount.value > 0) { triggerGlobalRefresh(); emit('upload-success'); }
    return;
  }
  isUploading.value = true;
  pending.status = 'uploading';
  try {
    await api.uploadFile(pending.path, pending.file, (p) => { pending.progress = p; });
    pending.status = 'success';
    pending.progress = 100;
  } catch (err) {
    pending.status = 'error';
    pending.error = err.message;
  } finally {
    isUploading.value = false;
    processQueue();
  }
};

const cancelUpload = (item) => { item.status = 'cancelled'; };

onMounted(() => {
  if (props.autoOpenSelect) setTimeout(triggerFileSelection, 100);
});
</script>
