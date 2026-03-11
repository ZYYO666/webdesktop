<template>
  <div
    class="flex items-center justify-between bg-white/60 backdrop-blur-xl border-b border-gray-100 z-30 flex-shrink-0 sticky top-0 h-12 px-3 pr-32"
    data-window-drag
  >
    <div class="flex items-center gap-2 flex-1 min-w-0">
      <div class="flex items-center gap-0.5 flex-shrink-0">
        <n-button-group>
          <n-button 
            quaternary
            circle
            size="small"
            @click="$emit('back')" 
            :disabled="!canGoBack"
            :title="'后退'"
            class="text-gray-500 hover:text-gray-900"
          >
            <template #icon>
              <n-icon :size="20" :component="ChevronLeft" />
            </template>
          </n-button>
          <n-button 
            quaternary
            circle
            size="small"
            @click="$emit('forward')" 
            :disabled="!canGoForward"
            :title="'前进'"
            class="text-gray-500 hover:text-gray-900"
          >
            <template #icon>
              <n-icon :size="20" :component="ChevronRight" />
            </template>
          </n-button>
        </n-button-group>
      </div>
      <div class="min-w-0 ml-1">
        <div class="text-[14px] font-semibold text-gray-800 truncate">
          {{ title || `文件` }}
        </div>
      </div>
    </div>

    <div class="flex items-center flex-shrink-0 gap-2">
      <div 
        class="transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] flex justify-end"
        :class="showSearchInput ? 'w-48' : 'w-8'"
      >
        <n-input 
          v-if="showSearchInput"
          ref="searchInputRef"
          :value="searchQuery"
          @update:value="$emit('update:searchQuery', $event)"
          @blur="handleSearchBlur"
          type="text" 
          :placeholder="'搜索'" 
          size="small"
          class="bg-gray-100/50 border-transparent hover:bg-gray-100 focus:bg-white text-[13px] !rounded-md"
        >
          <template #prefix>
            <n-icon :component="Search" :size="14" class="text-gray-400" />
          </template>
        </n-input>
        <n-button 
          v-else
          quaternary
          circle
          size="small"
          @click="handleSearchClick"
          :title="'搜索'"
          class="text-gray-500 hover:text-gray-900"
        >
          <template #icon>
            <n-icon :size="18" :component="Search" />
          </template>
        </n-button>
      </div>

      <n-dropdown trigger="click" :options="menuOptions" @select="handleMenuSelect">
        <n-button 
          quaternary
          circle
          size="small"
          :title="'选项'"
          class="text-gray-500 hover:text-gray-900"
        >
          <template #icon>
            <n-icon :size="18" :component="MoreHorizontal" />
          </template>
        </n-button>
      </n-dropdown>
    </div>
  </div>
</template>

<script setup>
import { computed, markRaw, h, ref, nextTick } from 'vue';
import { 
  ChevronLeft, ChevronRight, RefreshCw, Search, 
  FolderPlus, UploadCloud, LayoutGrid, List, Calendar,
  Image, Video, Music, Folder, FileText, Layers, MoreHorizontal
} from 'lucide-vue-next';
import { 
  NButton, NInput, NIcon, NDropdown, NButtonGroup
} from 'naive-ui';

const props = defineProps({
  canGoBack: Boolean,
  canGoForward: Boolean,
  loading: Boolean,
  title: {
    type: String,
    default: ''
  },
  searchQuery: String,
  viewMode: String,
  fileTypeFilter: String,
  isUploading: Boolean,
  uploadProgress: Number,
  windowWidth: {
    type: Number,
    default: null
  }
});

const emit = defineEmits([
  'toggle-sidebar', 'back', 'forward',
  '刷新', 'create-folder', 'trigger-upload',
  'update:searchQuery', 'update:viewMode', 'update:fileTypeFilter'
]);

const searchInputRef = ref(null);
const isSearchExpanded = ref(false);

const showSearchInput = computed(() => {
  return isSearchExpanded.value || (props.searchQuery && props.searchQuery.length > 0);
});

const handleSearchClick = async () => {
  isSearchExpanded.value = true;
  await nextTick();
  searchInputRef.value?.focus();
};

const handleSearchBlur = () => {
  if (!props.searchQuery) {
    isSearchExpanded.value = false;
  }
};

const filterOptions = computed(() => [
  { value: 'ALL', label: '所有类型', icon: markRaw(Layers) },
  { value: 'image', label: '照片', icon: markRaw(Image) },
  { value: 'video', label: '视频', icon: markRaw(Video) },
  { value: 'audio', label: '音频', icon: markRaw(Music) },
  { value: 'directory', label: '文件夹', icon: markRaw(Folder) },
  { value: 'document', label: '文档', icon: markRaw(FileText) }
]);

const viewOptions = computed(() => [
  { value: 'list', label: '列表视图', icon: markRaw(List) },
  { value: 'grid', label: '网格视图', icon: markRaw(LayoutGrid) },
  { value: 'media', label: '媒体视图', icon: markRaw(Image) },
  { value: 'timeline', label: '时间轴视图', icon: markRaw(Calendar) }
]);

const renderIcon = (icon) => {
  return () => h(NIcon, null, { default: () => h(icon, { size: 16 }) })
}

const menuOptions = computed(() => [
  {
    label: '新建文件夹',
    key: 'new-folder',
    icon: renderIcon(FolderPlus)
  },
  {
    label: props.isUploading ? `上传中 ${props.uploadProgress}%` : '上传文件',
    key: 'upload',
    icon: renderIcon(UploadCloud)
  },
  {
    type: 'divider',
    key: 'd1'
  },
  {
    label: '视图',
    key: 'view-mode',
    icon: renderIcon(LayoutGrid),
    children: viewOptions.value.map(mode => ({
      label: mode.label,
      key: `view:${mode.value}`,
      icon: renderIcon(mode.icon),
      props: {
        class: props.viewMode === mode.value ? 'text-blue-600 font-medium' : ''
      }
    }))
  },
  {
    label: '筛选',
    key: 'filter',
    icon: renderIcon(Layers),
    children: filterOptions.value.map(option => ({
      label: option.label,
      key: `filter:${option.value}`,
      icon: renderIcon(option.icon),
      props: {
        class: props.fileTypeFilter === option.value ? 'text-blue-600 font-medium' : ''
      }
    }))
  },
  {
    type: 'divider',
    key: 'd2'
  },
  {
    label: '刷新',
    key: '刷新',
    icon: renderIcon(RefreshCw)
  }
])

const handleMenuSelect = (key) => {
  if (key === 'new-folder') {
    emit('create-folder')
  } else if (key === 'upload') {
    emit('trigger-upload')
  } else if (key === '刷新') {
    emit('刷新')
  } else if (key.startsWith('view:')) {
    emit('update:viewMode', key.split(':')[1])
  } else if (key.startsWith('filter:')) {
    emit('update:fileTypeFilter', key.split(':')[1])
  }
}
</script>
