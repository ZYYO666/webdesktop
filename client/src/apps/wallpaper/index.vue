<template>
  <div class="h-full w-full flex flex-col bg-white text-slate-800 relative">
    <n-layout has-sider class="h-full w-full bg-transparent">
      <!-- Sidebar -->
      <n-layout-sider
        collapse-mode="transform"
        :collapsed="siderCollapsed"
        :collapsed-width="0"
        :width="220"
        :native-scrollbar="false"
        @update:collapsed="siderCollapsed = $event"
        class="bg-gray-50 h-full border-r border-gray-100"
      >
        <div class="h-full flex flex-col pb-4 overflow-y-auto select-none">
          <div class="shrink-0" style="height: var(--immersive-safe-top, 48px)" data-window-drag></div>
          
          <!-- Type Selector Group -->
          <div class="mb-4">
            <div class="px-4 py-1.5 text-[12px] font-bold text-gray-400/80 uppercase tracking-wide">类型</div>
            <div class="px-2 space-y-1.5">
              <button 
                @click="selectType('image')"
                class="group w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all cursor-default relative"
                :class="activeType === 'image' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
              >
                <Image :size="15" stroke-width="2" class="transition-colors duration-200" :class="activeType === 'image' ? 'text-white' : 'text-blue-500'" />
                <span class="truncate relative z-10">图片</span>
              </button>
              <button 
                @click="selectType('video')"
                class="group w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all cursor-default relative"
                :class="activeType === 'video' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
              >
                <Video :size="15" stroke-width="2" class="transition-colors duration-200" :class="activeType === 'video' ? 'text-white' : 'text-purple-500'" />
                <span class="truncate relative z-10">视频</span>
              </button>
            </div>
          </div>

          <!-- Source Selector Group -->
          <div class="mb-4">
            <div class="px-4 py-1.5 text-[12px] font-bold text-gray-400/80 uppercase tracking-wide">来源</div>
            <div class="px-2 space-y-1.5">
              <button 
                v-for="src in visibleSources" 
                :key="src.id"
                @click="selectSource(src.id)"
                class="group w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all cursor-default relative"
                :class="activeSource === src.id ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
              >
                <span class="truncate relative z-10">{{ src.name }}</span>
              </button>
            </div>
          </div>
        </div>
      </n-layout-sider>

      <!-- Main Content -->
      <n-layout class="h-full bg-transparent flex flex-col min-w-0" :native-scrollbar="false">
        <!-- Header -->
        <div class="flex items-center justify-between bg-white/60 backdrop-blur-xl border-b border-gray-100 z-30 flex-shrink-0 h-12 px-3 pr-3 md:pr-32 absolute top-0 left-0 right-0" data-window-drag>
          <div class="flex items-center gap-4 min-w-0 flex-1">
            <button
              class="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors md:hidden"
              title="菜单"
              @click="toggleSider"
            >
              <X v-if="!siderCollapsed" :size="18" />
              <Menu v-else :size="18" />
            </button>
            <div
              v-if="activeSource !== 'bing'"
              class="flex items-center justify-start transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
              :class="searchOpen ? 'w-48' : 'w-8'"
            >
              <n-input
                v-if="searchOpen"
                v-model:value="searchText"
                size="small"
                placeholder="搜索壁纸..."
                class="w-48 bg-gray-100/50 border-transparent hover:bg-gray-100 focus:bg-white text-[13px] !rounded-md"
                @keydown.enter="handleSearch"
                @blur="handleSearchBlur"
              >
                <template #prefix>
                  <n-icon :size="14" class="text-gray-400"><Search /></n-icon>
                </template>
              </n-input>
              <n-button
                v-else
                quaternary
                circle
                size="small"
                class="text-gray-500 hover:text-gray-900"
                @click="toggleSearch"
              >
                <template #icon>
                  <Search :size="18" />
                </template>
              </n-button>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
             <button @click="showSettings = true" class="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors" title="API 设置">
              <Settings :size="18" />
            </button>
          </div>
        </div>

        <n-layout-content
          class="flex-1 min-h-0 pt-12"
          content-style="display: flex; flex-direction: column; position: relative;"
          :native-scrollbar="false"
        >
          <div class="flex-1 min-h-0 overflow-y-auto bg-white">
            <div v-if="activeSource !== 'bing'" class="shrink-0 px-3 sm:px-6 py-2 border-b border-gray-100 bg-white">
              <div class="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <button
                  v-for="cat in categories"
                  :key="cat.id"
                  @click="selectCategory(cat.query)"
                  class="px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap"
                  :class="activeQuery === cat.query 
                    ? 'bg-slate-900 text-white shadow-md' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
                >
                  {{ cat.name }}
                </button>
              </div>
            </div>

            <div ref="scrollContainer" class="flex-1 overflow-y-auto p-3 sm:p-6 bg-white">
      <!-- Error / Config State -->
      <div v-if="errorMsg" class="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
        <AlertCircle :size="48" class="text-red-400 opacity-50" />
        <span class="text-sm text-center max-w-xs">{{ errorMsg }}</span>
        <button 
          v-if="errorIsConfig"
          @click="showSettings = true"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          配置 API Key
        </button>
      </div>

      <div v-else-if="loading && wallpapers.length === 0" class="h-full flex flex-col items-center justify-center text-slate-400">
        <Loader2 class="animate-spin mb-3" :size="32" />
        <span class="text-sm">正在加载精美{{ activeType === 'video' ? '视频' : '壁纸' }}...</span>
      </div>

      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        <div 
          v-for="(wp, index) in wallpapers" 
          :key="wp.id || index"
          class="group relative aspect-[16/10] rounded-xl overflow-hidden bg-slate-100 cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
          @click="previewWallpaper(wp)"
        >
          <img 
            :src="wp.thumbnailUrl" 
            loading="lazy"
            class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          
          <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
            <div class="text-white text-xs mb-2 line-clamp-1 opacity-90" v-if="wp.title">{{ wp.title }}</div>
            <div class="flex gap-2 justify-end">
              <button 
                @click.stop="openDetail(wp)"
                class="bg-white/90 hover:bg-white text-slate-900 p-1.5 rounded-lg shadow-lg backdrop-blur-sm transition-colors"
                title="查看详情"
              >
                <Info :size="14" />
              </button>
              <button 
                @click.stop="setWallpaper(wp)"
                :class="[
                  'bg-white/90 hover:bg-white text-slate-900 text-xs font-medium py-1.5 rounded-lg shadow-lg backdrop-blur-sm transition-colors flex items-center gap-1.5',
                  showSetWallpaperText ? 'px-3' : 'px-2'
                ]"
                :disabled="settingWallpaper"
              >
                <Monitor :size="14" />
                <span v-if="showSetWallpaperText">设为壁纸</span>
              </button>
            </div>
          </div>
          
          <!-- Source badge -->
          <div class="absolute top-2 right-2 bg-black/30 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider">
            <span>{{ activeSource }}</span>
          </div>

          <!-- Video Indicator -->
          <div v-if="activeType === 'video'" class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white/80 group-hover:scale-110 transition-transform">
            <div class="bg-black/40 backdrop-blur-sm p-3 rounded-full">
              <Play :size="24" fill="currentColor" />
            </div>
          </div>
        </div>
      </div>

      <!-- Loading more indicator -->
      <div v-if="loading && wallpapers.length > 0" class="py-8 flex justify-center text-slate-400">
        <Loader2 class="animate-spin" :size="24" />
      </div>
      
      <!-- Load More Button -->
      <div v-if="!loading && hasMore && wallpapers.length > 0" class="py-8 flex justify-center">
        <button 
          @click="fetchWallpapers(false)" 
          class="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-sm font-medium transition-colors flex items-center gap-2"
        >
          <span>加载更多</span>
          <ArrowDown :size="16" />
        </button>
      </div>

      <!-- End of list -->
      <div v-if="!hasMore && wallpapers.length > 0 && !errorMsg" class="py-8 text-center text-xs text-slate-400">
        - 已经到底啦 -
      </div>
            </div>
          </div>
        </n-layout-content>
      </n-layout>
    </n-layout>

    <n-modal
      v-model:show="showDetail"
      preset="card"
      :title="'壁纸详情'"
      :bordered="false"
      :mask-closable="true"
      class="w-[calc(100vw-24px)] max-w-4xl"
    >
      <div class="max-h-[75vh] overflow-y-auto">
        <div :class="['flex gap-6', detailSplit ? 'flex-row' : 'flex-col']">
          <div :class="[detailSplit ? 'w-2/3' : 'w-full', 'bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center min-h-[300px]']">
            <img
              :src="selectedWallpaper?.fullUrl || selectedWallpaper?.thumbnailUrl"
              class="max-w-full max-h-[500px] object-contain shadow-sm"
            />
          </div>

          <div :class="[detailSplit ? 'w-1/3' : 'w-full', 'space-y-6']">
            <div class="space-y-4">
              <div class="flex items-center justify-between pb-2 border-b border-gray-100">
                <span class="text-sm text-slate-500">来源</span>
                <span class="text-sm font-medium text-slate-900 uppercase">{{ activeSource }}</span>
              </div>

              <div v-if="detailData?.resolution" class="flex items-center justify-between pb-2 border-b border-gray-100">
                <span class="text-sm text-slate-500">分辨率</span>
                <span class="text-sm font-medium text-slate-900">{{ detailData.resolution }}</span>
              </div>

              <div v-if="detailData?.file_size" class="flex items-center justify-between pb-2 border-b border-gray-100">
                <span class="text-sm text-slate-500">大小</span>
                <span class="text-sm font-medium text-slate-900">{{ formatBytes(detailData.file_size) }}</span>
              </div>

              <div v-if="detailData?.created_at" class="flex items-center justify-between pb-2 border-b border-gray-100">
                <span class="text-sm text-slate-500">创建时间</span>
                <span class="text-sm font-medium text-slate-900">{{ formatDate(detailData.created_at) }}</span>
              </div>
            </div>

            <div class="space-y-3">
              <div class="flex items-center gap-2 text-slate-900 font-medium">
                <Tag :size="16" />
                <span>标签</span>
              </div>

              <div v-if="detailLoading" class="flex items-center gap-2 text-slate-400 text-sm">
                <Loader2 class="animate-spin" :size="16" />
                正在获取标签...
              </div>

              <div v-else-if="detailData?.tags && detailData.tags.length > 0" class="flex flex-wrap gap-2">
                <button
                  v-for="tag in detailData.tags"
                  :key="tag.id"
                  @click="searchTag(tag.name)"
                  class="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-md text-xs transition-colors"
                >
                  {{ tag.name }}
                </button>
              </div>

              <div v-else class="text-sm text-slate-400 italic">
                暂无标签信息
              </div>
            </div>

            <div v-if="detailData?.colors && detailData.colors.length > 0" class="space-y-3 pt-4 border-t border-gray-100">
              <div class="text-sm font-medium text-slate-900">配色方案</div>
              <div class="flex flex-wrap gap-2">
                <div
                  v-for="color in detailData.colors"
                  :key="color"
                  class="w-8 h-8 rounded-lg shadow-sm border border-black/5 cursor-pointer hover:scale-110 transition-transform"
                  :style="{ backgroundColor: color }"
                  :title="color"
                ></div>
              </div>
            </div>

            <div class="pt-6 mt-auto">
              <button
                @click="setWallpaper(selectedWallpaper)"
                class="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                :disabled="settingWallpaper"
              >
                <Monitor :size="16" />
                {{ settingWallpaper ? '正在设置...' : '设为壁纸' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </n-modal>

    <n-modal
      v-model:show="showSettings"
      preset="card"
      :title="'API 设置'"
      :bordered="false"
      :mask-closable="true"
      class="w-[calc(100vw-24px)] max-w-md"
    >
      <div class="max-h-[70vh] overflow-y-auto space-y-6">
        <div class="space-y-3">
          <div class="flex items-center gap-2 text-slate-900 font-medium">
            <div class="w-2 h-2 rounded-full bg-green-500"></div>
            Bing 壁纸
          </div>
          <p class="text-xs text-slate-500">无需配置，每日更新高质量壁纸（仅图片）。</p>
        </div>

        <div class="space-y-3 pt-4 border-t border-gray-100">
          <div class="flex items-center gap-2 text-slate-900 font-medium">
            <div class="w-2 h-2 rounded-full" :class="apiKeys.wallhaven ? 'bg-green-500' : 'bg-gray-300'"></div>
            Wallhaven API
          </div>
          <div class="space-y-2">
            <label class="text-xs text-slate-500">API Key (可选)</label>
            <n-input
              v-model:value="apiKeys.wallhaven"
              type="password"
              show-password-on="click"
              :placeholder="'输入 Wallhaven API Key'"
            />
            <div class="flex items-center gap-4 mt-2">
              <n-checkbox v-model:checked="wallhavenSettings.sfw">SFW (安全)</n-checkbox>
              <n-checkbox v-model:checked="wallhavenSettings.sketchy">Sketchy (限制级)</n-checkbox>
            </div>
            <p class="text-[10px] text-slate-400">
              仅支持图片。前往 <a href="https://wallhaven.cc/settings/account" target="_blank" class="text-blue-500 hover:underline">wallhaven.cc/settings</a> 获取 Key
            </p>
          </div>
        </div>

        <div class="space-y-3 pt-4 border-t border-gray-100">
          <div class="flex items-center gap-2 text-slate-900 font-medium">
            <div class="w-2 h-2 rounded-full" :class="apiKeys.pexels ? 'bg-green-500' : 'bg-gray-300'"></div>
            Pexels API
          </div>
          <div class="space-y-2">
            <label class="text-xs text-slate-500">API Key</label>
            <n-input v-model:value="apiKeys.pexels" type="password" show-password-on="click" :placeholder="'输入 Pexels API Key'" />
            <p class="text-[10px] text-slate-400">
              支持图片和视频。前往 <a href="https://www.pexels.com/api/" target="_blank" class="text-blue-500 hover:underline">pexels.com/api</a> 申请 Key
            </p>
          </div>
        </div>

        <div class="space-y-3 pt-4 border-t border-gray-100">
          <div class="flex items-center gap-2 text-slate-900 font-medium">
            <div class="w-2 h-2 rounded-full" :class="apiKeys.unsplash ? 'bg-green-500' : 'bg-gray-300'"></div>
            Unsplash API
          </div>
          <div class="space-y-2">
            <label class="text-xs text-slate-500">Access Key</label>
            <n-input v-model:value="apiKeys.unsplash" type="password" show-password-on="click" :placeholder="'输入 Unsplash Access Key'" />
            <p class="text-[10px] text-slate-400">
              仅支持图片。前往 <a href="https://unsplash.com/developers" target="_blank" class="text-blue-500 hover:underline">unsplash.com/developers</a> 申请 Key
            </p>
          </div>
        </div>

        <div class="space-y-3 pt-4 border-t border-gray-100">
          <div class="flex items-center gap-2 text-slate-900 font-medium">
            <div class="w-2 h-2 rounded-full" :class="apiKeys.pixabay ? 'bg-green-500' : 'bg-gray-300'"></div>
            Pixabay API
          </div>
          <div class="space-y-2">
            <label class="text-xs text-slate-500">API Key</label>
            <n-input v-model:value="apiKeys.pixabay" type="password" show-password-on="click" :placeholder="'输入 Pixabay API Key'" />
            <p class="text-[10px] text-slate-400">
              支持图片和视频。前往 <a href="https://pixabay.com/api/docs/" target="_blank" class="text-blue-500 hover:underline">pixabay.com/api/docs</a> 申请 Key
            </p>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end">
          <n-button type="primary" @click="saveSettings">{{ '保存配置' }}</n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { Loader2, Monitor, Settings, AlertCircle, ArrowDown, Image, Video, Play, Search, Info, Tag, Menu, X } from 'lucide-vue-next';
import { useOs } from '@/os';

const os = useOs();
const api = os.api;
const { wallpaper } = os.stores.system;

const sources = [
  { id: 'bing', name: 'Bing', types: ['image'] },
  { id: 'wallhaven', name: 'Wallhaven', types: ['image'] },
  { id: 'pexels', name: 'Pexels', types: ['image', 'video'] },
  { id: 'unsplash', name: 'Unsplash', types: ['image'] },
  { id: 'pixabay', name: 'Pixabay', types: ['image', 'video'] }
];

const categories = [
  { id: 1, name: '自然', query: 'nature' },
  { id: 2, name: '风景', query: 'landscape' },
  { id: 3, name: '建筑', query: 'architecture' },
  { id: 4, name: '城市', query: 'city' },
  { id: 5, name: '海洋', query: 'ocean' },
  { id: 6, name: '森林', query: 'forest' },
  { id: 7, name: '极简', query: 'minimalist' },
  { id: 8, name: '抽象', query: 'abstract' },
  { id: 9, name: '科技', query: 'technology' },
  { id: 10, name: '汽车', query: 'car' },
  { id: 11, name: '太空', query: 'space' },
  { id: 12, name: '动物', query: 'animals' },
  { id: 13, name: '艺术', query: 'art' },
  { id: 14, name: '纹理', query: 'texture' },
  { id: 15, name: '赛博朋克', query: 'cyberpunk' },
  { id: 16, name: '动漫', query: 'anime' },
  { id: 17, name: '美食', query: 'food' },
  { id: 18, name: '运动', query: 'sports' },
  { id: 19, name: '旅行', query: 'travel' },
  { id: 20, name: '霓虹', query: 'neon' },
  { id: 21, name: '美女', query: 'girl' }
];

const activeType = ref('image'); // 'image' | 'video'
const activeSource = ref('bing');
const activeQuery = ref('nature');
const searchText = ref('');
const searchOpen = ref(false);
const wallpapers = ref([]);
const loading = ref(false);
const page = ref(1);
const hasMore = ref(true);
const scrollContainer = ref(null);
const settingWallpaper = ref(false);
const showSettings = ref(false);
const errorMsg = ref('');
const errorIsConfig = ref(false);

const windowWidth = computed(() => {
  const w = os.window?.data?.width;
  return typeof w === 'number' ? w : window.innerWidth;
});

const isSmallScreen = computed(() => windowWidth.value < 768);
const siderCollapsed = ref(false);
const detailSplit = computed(() => windowWidth.value >= 900);
const showSetWallpaperText = computed(() => windowWidth.value >= 520);

watch(
  isSmallScreen,
  (small) => {
    siderCollapsed.value = small;
  },
  { immediate: true }
);

const toggleSider = () => {
  siderCollapsed.value = !siderCollapsed.value;
};

const closeSider = () => {
  if (isSmallScreen.value) siderCollapsed.value = true;
};

const toggleSearch = () => {
  searchOpen.value = true;
};

const handleSearchBlur = () => {
  const q = String(searchText.value || '').trim();
  if (!q) searchOpen.value = false;
};

const apiKeys = ref({
  wallhaven: '',
  pexels: '',
  unsplash: '',
  pixabay: ''
});

const wallhavenSettings = ref({
  sfw: true,
  sketchy: false
});

const loadAppDataMap = async () => {
  try {
    const rows = await os.appData.list();
    const map = new Map();
    if (Array.isArray(rows)) {
      rows.forEach((it) => {
        const k = String(it?.key || '').trim();
        if (!k) return;
        map.set(k, it?.value);
      });
    }
    return map;
  } catch {
    return new Map();
  }
};

const applySettingsFromAppData = (map) => {
  apiKeys.value.wallhaven = String(map.get('api_wallhaven') || '');
  apiKeys.value.pexels = String(map.get('api_pexels') || '');
  apiKeys.value.unsplash = String(map.get('api_unsplash') || '');
  apiKeys.value.pixabay = String(map.get('api_pixabay') || '');

  const sfw = map.get('wh_sfw');
  const sketchy = map.get('wh_sketchy');
  wallhavenSettings.value.sfw = typeof sfw === 'boolean' ? sfw : true;
  wallhavenSettings.value.sketchy = typeof sketchy === 'boolean' ? sketchy : false;
};


const visibleSources = computed(() => {
  return sources.filter(s => s.types.includes(activeType.value));
});

const saveSettings = async () => {
  try {
    await Promise.all([
      os.appData.set('api_wallhaven', String(apiKeys.value.wallhaven || '')),
      os.appData.set('api_pexels', String(apiKeys.value.pexels || '')),
      os.appData.set('api_unsplash', String(apiKeys.value.unsplash || '')),
      os.appData.set('api_pixabay', String(apiKeys.value.pixabay || '')),
      os.appData.set('wh_sfw', !!wallhavenSettings.value.sfw),
      os.appData.set('wh_sketchy', !!wallhavenSettings.value.sketchy),
    ]);

    showSettings.value = false;
    os.ui.toast.success('配置已保存');

    if ((errorIsConfig.value && activeSource.value !== 'bing') || activeSource.value === 'wallhaven') {
      fetchWallpapers(true);
    }
  } catch (err) {
    console.error(err);
    os.ui.toast.error('保存配置失败');
  }
};

onMounted(async () => {
  const map = await loadAppDataMap();
  applySettingsFromAppData(map);
});

const selectType = (type) => {
  if (activeType.value === type) return;
  activeType.value = type;
  
  const currentSource = sources.find(s => s.id === activeSource.value);
  if (!currentSource || !currentSource.types.includes(type)) {
    const firstCompatible = sources.find(s => s.types.includes(type));
    if (firstCompatible) {
      activeSource.value = firstCompatible.id;
    }
  }
  
  fetchWallpapers(true);
  closeSider();
};

const selectSource = (id) => {
  if (activeSource.value === id) return;
  activeSource.value = id;
  fetchWallpapers(true);
  closeSider();
};

const selectCategory = (query) => {
  if (activeQuery.value === query) return;
  activeQuery.value = query;
  searchText.value = '';
  fetchWallpapers(true);
  closeSider();
};

const handleSearch = () => {
  if (!searchText.value.trim()) return;
  activeQuery.value = searchText.value.trim();
  fetchWallpapers(true);
  closeSider();
};

const fetchWallhaven = async () => {
  const key = apiKeys.value.wallhaven;
  const purity = `${wallhavenSettings.value.sfw ? '1' : '0'}${wallhavenSettings.value.sketchy ? '1' : '0'}0`;
  
  // Wallhaven search with configurable purity
  // Use local proxy /wallhaven-api to avoid CORS issues
  // categories=111 ensures General, Anime, and People are all included
  let url = `/wallhaven-api/search?q=${activeQuery.value}&categories=111&purity=${purity}&sorting=relevance&page=${page.value}`;
  if (key) {
    url += `&apikey=${key}`;
  }

  const res = await fetch(url);
  
  if (!res.ok) {
    if (res.status === 401) {
      errorMsg.value = 'API Key 无效';
      errorIsConfig.value = true;
    } else if (res.status === 429) {
      errorMsg.value = '请求过于频繁';
      errorIsConfig.value = false;
    }
    throw new Error('API Error');
  }

  const data = await res.json();
  
  if (data.data && Array.isArray(data.data)) {
    if (data.data.length === 0) hasMore.value = false;
    return data.data.map(item => ({
      id: item.id,
      thumbnailUrl: item.thumbs.large,
      fullUrl: item.path,
      title: item.id,
      type: 'image'
    }));
  }
  return [];
};

const fetchBing = async () => {
  if (page.value > 1) {
    hasMore.value = false;
    return [];
  }

  const res = await fetch('https://peapix.com/bing/feed?country=cn');
  const data = await res.json();
  
  if (Array.isArray(data)) {
    hasMore.value = false;
    return data.map(item => ({
      id: item.date,
      thumbnailUrl: item.thumbUrl || item.imageUrl,
      fullUrl: item.fullUrl || item.imageUrl,
      title: item.title,
      type: 'image'
    }));
  }
  return [];
};

const fetchPexels = async () => {
  const key = apiKeys.value.pexels;
  if (!key) {
    errorMsg.value = '请先配置 Pexels API Key';
    errorIsConfig.value = true;
    throw new Error('No API Key');
  }

  const isVideo = activeType.value === 'video';
  const endpoint = isVideo 
    ? `https://api.pexels.com/videos/search?query=${activeQuery.value}&orientation=landscape&per_page=20&page=${page.value}`
    : `https://api.pexels.com/v1/search?query=${activeQuery.value}&orientation=landscape&per_page=20&page=${page.value}`;

  const res = await fetch(endpoint, {
    headers: { Authorization: key }
  });
  
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      errorMsg.value = 'API Key 无效，请检查配置';
      errorIsConfig.value = true;
    }
    throw new Error('API Error');
  }

  const data = await res.json();
  
  if (isVideo) {
    if (data.videos && Array.isArray(data.videos)) {
      if (data.videos.length === 0) hasMore.value = false;
      return data.videos.map(v => ({
        id: v.id,
        thumbnailUrl: v.image,
        fullUrl: v.video_files.find(f => f.quality === 'hd')?.link || v.video_files[0]?.link,
        title: v.user.name,
        type: 'video'
      }));
    }
  } else {
    if (data.photos && Array.isArray(data.photos)) {
      if (data.photos.length === 0) hasMore.value = false;
      return data.photos.map(p => ({
        id: p.id,
        thumbnailUrl: p.src.medium,
        fullUrl: p.src.original,
        title: p.photographer,
        type: 'image'
      }));
    }
  }
  return [];
};

const fetchUnsplash = async () => {
  const key = apiKeys.value.unsplash;
  if (!key) {
    errorMsg.value = '请先配置 Unsplash Access Key';
    errorIsConfig.value = true;
    throw new Error('No API Key');
  }

  const res = await fetch(`https://api.unsplash.com/search/photos?query=${activeQuery.value}&orientation=landscape&per_page=20&page=${page.value}`, {
    headers: { Authorization: `Client-ID ${key}` }
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      errorMsg.value = 'API Key 无效，请检查配置';
      errorIsConfig.value = true;
    } else if (res.status === 429) {
      errorMsg.value = 'API 请求次数超限 (50次/小时)';
      errorIsConfig.value = false;
    }
    throw new Error('API Error');
  }

  const data = await res.json();
  if (data.results && Array.isArray(data.results)) {
    if (data.results.length === 0) hasMore.value = false;
    return data.results.map(p => ({
      id: p.id,
      thumbnailUrl: p.urls.small,
      fullUrl: p.urls.regular,
      title: p.description || p.alt_description || p.user.name,
      type: 'image',
      heat: p.likes
    }));
  }
  return [];
};

const fetchPixabay = async () => {
  const key = apiKeys.value.pixabay;
  if (!key) {
    errorMsg.value = '请先配置 Pixabay API Key';
    errorIsConfig.value = true;
    throw new Error('No API Key');
  }

  const isVideo = activeType.value === 'video';
  const baseUrl = isVideo ? 'https://pixabay.com/api/videos/' : 'https://pixabay.com/api/';
  
  const res = await fetch(`${baseUrl}?key=${key}&q=${activeQuery.value}&per_page=20&page=${page.value}&image_type=photo`);
  
  if (!res.ok) {
    if (res.status === 400 || res.status === 401) {
      errorMsg.value = 'API Key 无效，请检查配置';
      errorIsConfig.value = true;
    }
    throw new Error('API Error');
  }

  const data = await res.json();
  
  if (data.hits && Array.isArray(data.hits)) {
    if (data.hits.length === 0) hasMore.value = false;
    
    if (isVideo) {
      return data.hits.map(v => ({
        id: v.id,
        // Pixabay returns "picture_id" for videos.
        // The thumbnail is: https://i.vimeocdn.com/video/{picture_id}_{width}x{height}.jpg
        thumbnailUrl: `https://i.vimeocdn.com/video/${v.picture_id}_640x360.jpg`,
        fullUrl: v.videos.large.url || v.videos.medium.url,
        title: v.tags,
        type: 'video'
      }));
    } else {
      return data.hits.map(p => ({
        id: p.id,
        thumbnailUrl: p.webformatURL,
        fullUrl: p.largeImageURL,
        title: p.tags,
        type: 'image'
      }));
    }
  }
  return [];
};

const fetchWallpapers = async (reset = false) => {
  if (loading.value || (!hasMore.value && !reset)) return;
  
  loading.value = true;
  errorMsg.value = '';
  errorIsConfig.value = false;

  if (reset === true) {
    page.value = 1;
    wallpapers.value = [];
    hasMore.value = true;
  }

  try {
    let newItems = [];
    if (activeSource.value === 'bing') {
      newItems = await fetchBing();
    } else if (activeSource.value === 'wallhaven') {
      newItems = await fetchWallhaven();
    } else if (activeSource.value === 'pexels') {
      newItems = await fetchPexels();
    } else if (activeSource.value === 'unsplash') {
      newItems = await fetchUnsplash();
    } else if (activeSource.value === 'pixabay') {
      newItems = await fetchPixabay();
    }

    if (newItems.length > 0) {
      const uniqueNew = newItems.filter(item => !wallpapers.value.some(w => w.id === item.id));
      wallpapers.value = [...wallpapers.value, ...uniqueNew];
      if (activeSource.value !== 'bing') {
        page.value++;
      }
    } else {
      if (!errorMsg.value) hasMore.value = false;
    }

  } catch (err) {
    console.error(err);
    if (!errorMsg.value) {
      os.ui.toast.error('获取资源失败');
      hasMore.value = false;
    }
  } finally {
    loading.value = false;
  }
};

const normalizeWallpaperConfig = (raw) => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const images = Array.isArray(parsed.images) ? parsed.images : [];
    const videos = Array.isArray(parsed.videos) ? parsed.videos : [];
    const mode = String(parsed.mode || 'slideshow').toLowerCase() === 'video' ? 'video' : 'slideshow';
    const interval = Number(parsed.slideshowInterval);
    return {
      mode,
      fixedUrl: String(parsed.fixedUrl || ''),
      videoUrl: String(parsed.videoUrl || ''),
      enabled: parsed.enabled !== false,
      slideshowInterval: Number.isFinite(interval) ? interval : 60000,
      images,
      videos
    };
  } catch {
    return null;
  }
};

const buildDefaultConfig = () => ({
  mode: 'slideshow',
  fixedUrl: '',
  videoUrl: '',
  enabled: true,
  slideshowInterval: 60000,
  images: [],
  videos: []
});

const setWallpaper = async (wp) => {
  if (settingWallpaper.value) return;
  settingWallpaper.value = true;
  
  try {
    const cleanUrl = String(wp.fullUrl || '').trim();
    if (!cleanUrl) return;

    let baseConfig = normalizeWallpaperConfig(wallpaper.value) || buildDefaultConfig();

    if (wp.type === 'video') {
      const videos = Array.isArray(baseConfig.videos) ? baseConfig.videos.slice() : [];
      if (!videos.includes(cleanUrl)) videos.unshift(cleanUrl);
      baseConfig = {
        ...baseConfig,
        mode: 'video',
        videoUrl: cleanUrl,
        enabled: true,
        videos
      };
    } else {
      const images = Array.isArray(baseConfig.images) ? baseConfig.images.slice() : [];
      if (!images.includes(cleanUrl)) images.unshift(cleanUrl);
      baseConfig = {
        ...baseConfig,
        mode: 'slideshow',
        fixedUrl: cleanUrl,
        enabled: true,
        slideshowInterval: 0,
        images
      };
    }

    const config = JSON.stringify(baseConfig);

    await api.updateProfile({ wallpaper: config });
    os.stores.system.updateSiteInfo({ wallpaper: config });
    os.ui.toast.success('壁纸设置成功');
  } catch (err) {
    console.error(err);
    os.ui.toast.error('设置壁纸失败');
  } finally {
    settingWallpaper.value = false;
  }
};

const previewWallpaper = (wp) => {
  const videoPlayerApp = Object.values(os.apps).find(app => app.id === 'video-player');
  if (!videoPlayerApp) {
    os.ui.toast.error('无法预览：未找到媒体播放器');
    return;
  }

  os.stores.windows.openWindow({
    ...videoPlayerApp,
    title: wp.title || '壁纸预览',
    width: 960,
    height: 640,
    componentProps: {
      files: [{
        name: wp.title || 'wallpaper',
        url: wp.fullUrl,
        type: wp.type
      }]
    }
  });
};

// Detail Modal Logic
const showDetail = ref(false);
const selectedWallpaper = ref(null);
const detailData = ref(null);
const detailLoading = ref(false);

const formatBytes = (bytes, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const formatDate = (dateString) => {
  if (!dateString) return '未知';
  return new Date(dateString).toLocaleDateString('zh-CN');
};

const openDetail = async (wp) => {
  selectedWallpaper.value = wp;
  showDetail.value = true;
  detailData.value = null;
  detailLoading.value = true;

  try {
    if (activeSource.value === 'wallhaven') {
      const url = `/wallhaven-api/w/${wp.id}${apiKeys.value.wallhaven ? '?apikey=' + apiKeys.value.wallhaven : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      detailData.value = data.data;
    } else if (activeSource.value === 'unsplash') {
      const key = apiKeys.value.unsplash;
      if (key) {
        const res = await fetch(`https://api.unsplash.com/photos/${wp.id}`, {
          headers: { Authorization: `Client-ID ${key}` }
        });
        const data = await res.json();
        detailData.value = {
          resolution: `${data.width}x${data.height}`,
          created_at: data.created_at,
          tags: data.tags ? data.tags.map(t => ({ id: t.title, name: t.title })) : [],
          colors: [data.color],
          file_size: 0
        };
      }
    } else if (activeSource.value === 'pixabay') {
      const tags = wp.title ? wp.title.split(', ').map(t => ({ id: t, name: t })) : [];
      detailData.value = {
        tags: tags,
        resolution: 'Unknown',
      };
    } else {
      detailData.value = {
        tags: [],
        resolution: 'Unknown'
      };
    }
  } catch (err) {
    console.error('Failed to fetch details:', err);
    os.ui.toast.error('获取详情失败');
  } finally {
    detailLoading.value = false;
  }
};

const searchTag = (tagName) => {
  activeQuery.value = tagName;
  searchText.value = '';
  showDetail.value = false;
  fetchWallpapers(true);
};

onMounted(() => {
  fetchWallpapers(true);
});
</script>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
