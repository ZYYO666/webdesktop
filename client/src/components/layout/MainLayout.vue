<template>
  <div
    class="flex w-full bg-gray-50 font-sans selection:bg-black selection:text-white"
    :class="isAuthRoute ? 'min-h-[100dvh] overflow-y-auto' : 'h-screen overflow-hidden'"
  >
    <main
      class="flex-1 flex flex-col relative bg-white"
      :class="[isAuthRoute ? 'min-h-[100dvh]' : 'h-full overflow-hidden', { 'pb-24': !noBottomPaddingRoutes }]"
    >
      <router-view v-slot="{ Component }">
        <transition
          mode="out-in"
          enter-active-class="transition-opacity duration-200 ease-out"
          leave-active-class="transition-opacity duration-200 ease-in"
          enter-from-class="opacity-0"
          leave-to-class="opacity-0"
        >
          <component :is="Component" :key="route.fullPath" :class="isAuthRoute ? 'w-full' : 'h-full w-full'" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const isAuthRoute = computed(() => {
  const name = route.name ? String(route.name) : '';
  return name === 'login';
});
const noBottomPaddingRoutes = computed(() => {
  const name = route.name ? String(route.name) : '';
  return ['desktop', 'login'].includes(name);
});
</script>
