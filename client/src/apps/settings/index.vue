<template>
  <!-- Logged In View -->
  <div v-if="isLoggedIn" ref="rootRef" class="settings-shell w-full h-full bg-white flex flex-col overflow-hidden relative text-gray-900">
    <n-layout has-sider class="h-full w-full bg-transparent">
      <!-- Desktop Sidebar -->
      <n-layout-sider
        collapse-mode="transform"
        :collapsed-width="0"
        :width="220"
        :native-scrollbar="false"
        class="bg-gray-50 h-full border-r border-gray-100"
      >
        <div class="h-full flex flex-col pb-4 overflow-y-auto select-none">
          <div class="shrink-0" style="height: var(--immersive-safe-top, 48px)" data-window-drag></div>
          
          <!-- User Profile Header -->
          <div 
            class="flex items-center gap-3 px-3 py-2 mb-2 cursor-pointer hover:bg-black/5 transition-all mx-2 mt-3 rounded-lg"
            @click="handleLogout"
            :title="'退出登录'"
          >
            <div class="w-9 h-9 rounded-full bg-gray-200 overflow-hidden shrink-0 border border-gray-200/50">
              <img 
                v-if="userAvatar" 
                :src="userAvatar" 
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex items-center justify-center bg-gray-900 text-white font-bold text-sm">
                {{ userInitials }}
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-medium text-gray-900 truncate text-[13px] leading-tight">{{ userName }}</div>
              <div class="text-[11px] text-gray-500 truncate capitalize leading-tight mt-0.5">{{ userRole }}</div>
            </div>
          </div>

          <!-- Sidebar Content -->
          <div class="flex-1 pt-1 overflow-y-auto select-none">
            <div class="mt-2">
              <div class="px-4 py-1.5 text-[12px] font-bold text-gray-400/80 uppercase tracking-wide">用户设置</div>
              <div class="px-2 space-y-1.5">
                <div
                  v-for="tab in tabs.filter(t => ['profile', 'wallpaper', 'shares', 'mounts'].includes(t.id))"
                  :key="tab.id"
                  @click="selectTab(tab.id)"
                  class="group flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all cursor-default relative"
                  :class="currentTab === tab.id ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
                >
                  <component
                    :is="tab.icon"
                    :size="15"
                    class="transition-colors duration-200"
                    :class="currentTab === tab.id ? 'text-white' : 'text-gray-500 group-hover:text-gray-600'"
                    stroke-width="2"
                  />
                  <span class="truncate relative z-10">{{ tab.name }}</span>
                </div>
              </div>
            </div>

            <template v-if="tabs.some(t => ['general', 'users'].includes(t.id))">
              <div class="mt-4">
                <div class="px-4 py-1.5 text-[12px] font-bold text-gray-400/80 uppercase tracking-wide">系统管理</div>
                <div class="px-2 space-y-1.5">
                  <div
                    v-for="tab in tabs.filter(t => ['general', 'users'].includes(t.id))"
                    :key="tab.id"
                    @click="selectTab(tab.id)"
                    class="group flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all cursor-default relative"
                    :class="currentTab === tab.id ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
                  >
                    <component
                      :is="tab.icon"
                      :size="15"
                      class="transition-colors duration-200"
                      :class="currentTab === tab.id ? 'text-white' : 'text-gray-500 group-hover:text-gray-600'"
                      stroke-width="2"
                    />
                    <span class="truncate relative z-10">{{ tab.name }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </n-layout-sider>

      <!-- Right Side: Header + Content -->
      <n-layout class="h-full bg-transparent flex flex-col min-w-0" :native-scrollbar="false">
        <!-- Top Bar -->
        <div
          class="flex items-center justify-between bg-white/60 backdrop-blur-xl border-b border-gray-100 z-30 flex-shrink-0 h-12 px-3 pr-32 absolute top-0 left-0 right-0"
          data-window-drag
        >
          <div class="flex items-center gap-2">
            <h2 class="text-[14px] font-bold text-gray-900">{{ currentTabName }}</h2>
          </div>
        </div>

        <!-- Content Area -->
        <n-layout-content 
          class="bg-transparent flex-1 relative overflow-hidden pt-12" 
          content-style="display: flex; flex-direction: column;"
          :native-scrollbar="false"
        >
          <component :is="activeComponent" class="h-full" />
        </n-layout-content>
      </n-layout>
    </n-layout>
  </div>

  <!-- Guest View (Login Required) -->
  <div v-else class="w-full h-full bg-white flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-300" data-window-drag>
    <div class="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-gray-100">
       <Lock class="w-10 h-10 text-gray-300" stroke-width="1.5" />
    </div>
    <!-- Login Required Message -->
    <h2 class="text-xl font-bold text-gray-900 mb-2">{{ '需要登录' }}</h2>
    <p class="text-gray-500 max-w-xs mb-8 leading-relaxed">{{ '请登录以访问此功能。' }}</p>
    
    <n-button 
      @click="handleLogin"
      type="primary"
      size="large"
      class="px-8"
    >
      <template #icon><n-icon :size="20"><LogIn /></n-icon></template>
      <span>{{ '登录' }}</span>
    </n-button>
  </div>
</template>

<script setup>
import { ref, computed, markRaw, inject } from 'vue';
import { Settings, Server, Users, User, LogIn, Lock, Image, Link2 } from 'lucide-vue-next';
import { NLayout, NLayoutSider, NLayoutContent, NButton, NIcon } from 'naive-ui';
import { useRouter } from 'vue-router';
import { useOs } from '@/os';
import GeneralSettings from './components/GeneralSettings.vue';
import MountSettings from './components/MountSettings.vue';
import UserSettings from './components/UserSettings.vue';
import ProfileSettings from './components/ProfileSettings.vue';
import WallpaperSettings from './components/WallpaperSettings.vue';
import ShareSettings from './components/ShareSettings.vue';

const router = useRouter();
const os = useOs();

const props = defineProps({
  closeWindow: {
    type: Function,
    default: null
  },
  id: {
    type: [String, Number],
    default: null
  },
  windowWidth: {
    type: Number,
    default: null
  },
  windowHeight: {
    type: Number,
    default: null
  }
});

const injectedCloseWindow = inject('closeWindow', null);

const closeSelf = () => {
  os.window.close();
  if (typeof props.closeWindow === 'function') props.closeWindow();
  if (typeof injectedCloseWindow === 'function') injectedCloseWindow();
};

const dialog = computed(() => os.ui.dialog);
const isLoggedIn = computed(() => os.stores.auth.isLoggedIn);
const hasRole = (role) => os.stores.auth.hasRole(role) ?? false;

const userAvatar = computed(() => os.stores.auth.user?.avatar || '');
const userName = computed(() => os.stores.auth.user?.username || os.stores.auth.user?.name || 'User');
const userRole = computed(() => os.stores.auth.user?.role || 'user');
const userInitials = computed(() => (userName.value || 'U').slice(0, 2).toUpperCase());

const tabs = computed(() => {
  const allTabs = [
    { id: 'profile', name: '个人资料', icon: markRaw(User), component: ProfileSettings },
    { id: 'wallpaper', name: '壁纸设置', icon: markRaw(Image), component: WallpaperSettings },
    { id: 'shares', name: '文件共享', icon: markRaw(Link2), component: ShareSettings },
  ];

  if (hasRole('user')) {
    allTabs.push({ id: 'mounts', name: '挂载管理', icon: markRaw(Server), component: MountSettings });
  }

  if (hasRole('admin')) {
    allTabs.unshift(
      { id: 'general', name: `常规设置`, icon: markRaw(Settings), component: GeneralSettings }
    );
    allTabs.push(
      { id: 'users', name: `用户管理`, icon: markRaw(Users), component: UserSettings }
    );
  }
  
  return allTabs;
});

const currentTab = ref('profile');
const rootRef = ref(null);

const currentTabName = computed(() => {
  const tab = tabs.value.find(t => t.id === currentTab.value);
  return tab ? tab.name : '';
});

const activeComponent = computed(() => {
  const tab = tabs.value.find(t => t.id === currentTab.value);
  return tab ? tab.component : GeneralSettings;
});

const selectTab = (tabId) => {
  currentTab.value = tabId;
};

const handleLogout = async () => {
  const confirmed = await dialog.value.confirm('确定要退出登录吗？');
  if (confirmed) {
    os.stores.auth.logout();
    window.location.reload();
  }
};

const handleLogin = () => {
  closeSelf();
  router.push('/login');
};
</script>

<style scoped>
:deep(.settings-shell .n-card) {
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(18px);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(15, 23, 42, 0.06);
}

:deep(.settings-shell .n-card .n-card-header) {
  font-weight: 600;
  color: rgb(17 24 39);
}

:deep(.settings-shell .n-form-item-label) {
  color: rgb(31 41 55);
}
</style>
