<template>
  <div class="h-full flex flex-col pt-4 pb-4 overflow-y-auto select-none" data-window-drag>
    <div v-for="group in menuGroups" :key="group.key" class="mb-4 last:mb-0">
      <div v-if="group.label" class="px-4 py-1.5 text-[12px] font-bold text-gray-400/80 uppercase tracking-wide">
        {{ group.label }}
      </div>
      <div class="px-2 space-y-1.5">
        <div 
          v-for="item in group.children" 
          :key="item.key"
          @click="handleNavigate(item.key)"
          class="group flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all cursor-default relative"
          :class="isActive(item.key) ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
        >
          <component 
            :is="item.icon" 
            :size="15" 
            class="transition-colors duration-200"
            :class="isActive(item.key) ? 'text-white' : (item.color || 'text-gray-500')" 
            stroke-width="2"
          />
          <span class="truncate relative z-10">{{ item.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Trash2, Monitor, Image, Download, FileText, Cloud, Home } from 'lucide-vue-next';

const props = defineProps({
  currentPath: {
    type: String,
    default: ''
  },
  visible: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['navigate']);
const isActive = (key) => {
  if (!props.currentPath && key === '/') return true;
  return props.currentPath === key;
};

const handleNavigate = (key) => {
  emit('navigate', key);
};

const menuGroups = computed(() => [
  {
    key: 'favorites',
    label: '',
    children: [
      {
        label: '首页',
        key: '/',
        icon: Home,
        color: 'text-blue-500'
      },
      {
        label: '桌面',
        key: '/desktop',
        icon: Monitor,
        color: 'text-indigo-500'
      },
      {
        label: '文档',
        key: '/documents',
        icon: FileText,
        color: 'text-orange-500'
      },
      {
        label: '下载',
        key: '/downloads',
        icon: Download,
        color: 'text-green-500'
      },
      {
        label: '照片',
        key: '/photos',
        icon: Image,
        color: 'text-pink-500'
      }
    ]
  },
  {
    key: 'locations',
    label: '位置',
    children: [
      {
        label: 'iCloud Drive',
        key: '/icloud',
        icon: Cloud,
        color: 'text-cyan-500'
      },
      {
        label: '回收站',
        key: '.trash',
        icon: Trash2,
        color: 'text-gray-500'
      }
    ]
  }
]);
</script>
