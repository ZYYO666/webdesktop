<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <n-global-style />
    <n-message-provider>
      <n-dialog-provider>
        <div
          class="w-screen bg-gray-50 font-sans relative"
          :class="isAuthRoute ? 'min-h-[100dvh] overflow-y-auto' : 'h-screen overflow-hidden'"
        >
          <WindowContainer />
          <MainLayout />
          <div
            v-if="showOsBootLoading"
            class="os-boot-overlay fixed inset-0 z-[9999] flex items-center justify-center"
            :class="osBootFadingOut ? 'os-boot-overlay--fadeout' : 'os-boot-overlay--show'"
          >
            <div class="flex flex-col items-center gap-4">
              <div class="os-boot-icon flex h-[72px] w-[72px] items-center justify-center">
                <div class="os-boot-icon-mark"></div>
              </div>
              <div class="os-boot-progress w-[240px]">
                <div class="os-boot-progress-bar"></div>
              </div>
              <div class="text-xs font-medium text-gray-700">
                {{ systemStore.appTitle }}
              </div>
            </div>
          </div>
        </div>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup>
import WindowContainer from './components/layout/WindowContainer.vue';
import MainLayout from './components/layout/MainLayout.vue';
import { useSystemStore } from './os/store/system';
import { createOs, provideOs } from '@/os';
import { computed, onMounted, ref } from 'vue';

const os = createOs();
provideOs(os);

const systemStore = useSystemStore();
const { fetchSiteInfo } = systemStore;
const SITE_INFO_REFRESH_EVENT = 'siteinfo:refresh';
const refreshHandler = () => fetchSiteInfo();

const isAuthRoute = computed(() => {
  return window.location.pathname === '/login';
});

const osBootReady = ref(false);
const osBootFadingOut = ref(false);
const showOsBootLoading = computed(() => {
  if (isAuthRoute.value) return false;
  return !osBootReady.value || osBootFadingOut.value;
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

onMounted(async () => {
  if (isAuthRoute.value) {
    osBootReady.value = true;
    osBootFadingOut.value = false;
    return;
  }
  window.addEventListener(SITE_INFO_REFRESH_EVENT, refreshHandler);
  const startedAt = performance.now();
  const MIN_BOOT_MS = 900;
  const FADE_OUT_MS = 240;
  try {
    await fetchSiteInfo();
  } finally {
    const elapsed = performance.now() - startedAt;
    if (elapsed < MIN_BOOT_MS) await sleep(MIN_BOOT_MS - elapsed);
    osBootReady.value = true;
    osBootFadingOut.value = true;
    await sleep(FADE_OUT_MS);
    osBootFadingOut.value = false;
  }
});

const themeOverrides = {
  common: {
    primaryColor: '#2563eb', // Blue-600
    primaryColorHover: '#3b82f6', // Blue-500
    primaryColorPressed: '#1d4ed8', // Blue-700
    primaryColorSuppl: '#3b82f6',
    
    infoColor: '#0ea5e9', // Sky-500
    successColor: '#10b981', // Emerald-500
    warningColor: '#f59e0b', // Amber-500
    errorColor: '#ef4444', // Red-500
    
    borderRadius: '12px',
    borderRadiusSmall: '8px',
    
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    
    fontSize: '14px',
    fontSizeMedium: '14px',
    fontSizeSmall: '12px',
    fontSizeLarge: '16px',
    
    heightMedium: '40px',
    heightSmall: '32px',
    heightLarge: '48px',
    
    textColorBase: '#1f2937', // Gray-800
    textColor1: '#111827', // Gray-900
    textColor2: '#374151', // Gray-700
    textColor3: '#6b7280', // Gray-500
  },
  Button: {
    borderRadiusMedium: '10px',
    borderRadiusLarge: '12px',
    borderRadiusSmall: '8px',
    fontWeight: '500',
    paddingMedium: '0 20px',
    paddingLarge: '0 24px',
    fontSizeMedium: '14px',
    border: '1px solid #e5e7eb', // Gray-200
    textColor: '#374151',
    colorHover: '#f9fafb', // Gray-50
    borderHover: '#d1d5db', // Gray-300
    colorPressed: '#f3f4f6', // Gray-100
    borderPressed: '#d1d5db',
    // Primary Type
    colorPrimary: '#2563eb',
    colorHoverPrimary: '#3b82f6',
    colorPressedPrimary: '#1d4ed8',
    borderPrimary: 'none',
    borderHoverPrimary: 'none',
    borderPressedPrimary: 'none',
  },
  Input: {
    borderRadius: '10px',
    heightMedium: '40px',
    border: '1px solid #e5e7eb',
    borderHover: '1px solid #9ca3af',
    borderFocus: '1px solid #2563eb',
    boxShadowFocus: 'none', // Removed shadow
    color: '#ffffff',
    textColor: '#111827',
    placeholderColor: '#9ca3af',
  },
  Card: {
    borderRadius: '16px',
    borderColor: '#e5e7eb', // Slightly darker border for definition
    boxShadow: 'none', // Removed shadow
  },
  Modal: {
    borderRadius: '20px',
    boxShadow: 'none', // Removed shadow
    border: '1px solid #e5e7eb', // Added border for definition
  },
  Dialog: {
    borderRadius: '20px',
    padding: '24px',
    titleFontSize: '18px',
    titleFontWeight: '600',
    iconSize: '32px',
    border: '1px solid #e5e7eb', // Added border
  },
  Dropdown: {
    borderRadius: '12px',
    padding: '6px',
    optionHeightMedium: '36px',
    optionBorderRadius: '8px',
    boxShadow: 'none', // Removed shadow
    border: '1px solid #e5e7eb', // Added border
    optionColorHover: '#f3f4f6', 
    optionColorActive: '#eff6ff', 
    optionTextColorHover: '#111827', 
    optionTextColorActive: '#2563eb', 
  },
  Menu: {
    borderRadius: '12px',
    itemHeightMedium: '40px',
    itemBorderRadius: '10px',
    fontSizeMedium: '14px',
    itemTextColor: '#4b5563', 
    itemTextColorActive: '#2563eb', 
    itemIconColor: '#9ca3af', 
    itemIconColorActive: '#2563eb', 
    itemColorActive: '#eff6ff', 
    itemColorHover: '#f9fafb', 
  },
  Tabs: {
    tabFontSizeMedium: '14px',
    tabFontWeightActive: '600',
    tabTextColorActiveLine: '#2563eb',
    barColor: '#2563eb',
  },
  Switch: {
    railColor: '#e5e7eb',
    railColorActive: '#2563eb',
    buttonBoxShadow: 'none', // Removed shadow
    railBorder: '1px solid #d1d5db', // Added border to rail
  },
  Slider: {
    fillColor: '#2563eb',
    fillColorHover: '#3b82f6',
    handleSize: '16px',
    handleBoxShadow: 'none', // Removed shadow
    handleBorder: '1px solid #e5e7eb', // Added border to handle
  }
};
</script>

<style>
.os-boot-overlay {
  background:
    radial-gradient(1200px 600px at 50% 35%, rgba(255, 255, 255, 0.9) 0%, rgba(243, 244, 246, 0.9) 55%, rgba(229, 231, 235, 0.9) 100%),
    linear-gradient(180deg, #f8fafc 0%, #f3f4f6 100%);
  opacity: 0;
  transform: scale(1.01);
  transition: opacity 240ms ease, transform 240ms ease;
  will-change: opacity, transform;
}

.os-boot-overlay--show {
  opacity: 1;
  transform: scale(1);
}

.os-boot-overlay--fadeout {
  opacity: 0;
  transform: scale(1.01);
}

.os-boot-icon {
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(18px);
  box-shadow:
    0 24px 60px rgba(17, 24, 39, 0.12),
    0 2px 0 rgba(255, 255, 255, 0.7) inset;
}

.os-boot-icon-mark {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.95), rgba(59, 130, 246, 0.85) 45%, rgba(29, 78, 216, 0.95) 100%);
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.25);
}

.os-boot-progress {
  height: 6px;
  border-radius: 999px;
  background: rgba(229, 231, 235, 0.9);
  border: 1px solid rgba(209, 213, 219, 0.7);
  overflow: hidden;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.7) inset;
}

.os-boot-progress-bar {
  height: 100%;
  width: 45%;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(156, 163, 175, 0.0), rgba(107, 114, 128, 0.9), rgba(156, 163, 175, 0.0));
  animation: os-boot-indeterminate 1.2s ease-in-out infinite;
}

@keyframes os-boot-indeterminate {
  0% {
    transform: translateX(-120%);
    opacity: 0.0;
  }
  20% {
    opacity: 0.9;
  }
  50% {
    transform: translateX(120%);
    opacity: 0.9;
  }
  80% {
    opacity: 0.7;
  }
  100% {
    transform: translateX(220%);
    opacity: 0.0;
  }
}
</style>
