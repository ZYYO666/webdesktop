<template>
  <div class="h-12 flex items-center px-4 bg-white z-30 flex-shrink-0">
    <nav class="flex items-center text-sm font-medium text-gray-500 overflow-x-auto no-scrollbar whitespace-nowrap mask-linear-fade min-w-0 w-full">
      <n-button 
        quaternary 
        size="small"
        @click="$emit('navigate', '/')"
        class="flex-shrink-0 !text-gray-500 hover:!text-gray-900"
      >
        <template #icon>
          <n-icon :size="16" :component="Home" />
        </template>
        <span class="ml-1">{{ '首页' }}</span>
      </n-button>
      <template v-for="(segment, index) in pathSegments" :key="index">
        <span class="mx-1 text-gray-500 flex-shrink-0">/</span>
        <n-button 
          quaternary
          size="small"
          @click="$emit('navigate', segment.fullPath)"
          class="flex-shrink-0 truncate !text-gray-500 hover:!text-gray-900"
          :style="{ maxWidth: segmentMaxWidth }"
          :class="{ 'font-bold': index === pathSegments.length - 1 }"
        >
          {{ segment.name }}
        </n-button>
      </template>
    </nav>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Home } from 'lucide-vue-next';
import { NButton, NIcon } from 'naive-ui';

const props = defineProps({
  path: {
    type: String,
    default: ''
  },
  windowWidth: {
    type: Number,
    default: null
  }
});

const pathSegments = computed(() => {
  if (!props.path || props.path === '/') return [];
  const segments = props.path.split('/').filter(Boolean);
  return segments.map((segment, index) => ({
    name: segment,
    fullPath: '/' + segments.slice(0, index + 1).join('/')
  }));
});

const segmentMaxWidth = computed(() => {
  const w = props.windowWidth ?? window.innerWidth;
  return w >= 640 ? '150px' : '100px';
});
</script>
