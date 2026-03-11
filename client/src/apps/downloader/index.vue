<template>
  <div class="h-full w-full flex flex-col bg-white text-slate-900 relative">
    <n-layout has-sider class="h-full w-full bg-transparent">
      <!-- Sidebar -->
      <n-layout-sider
        collapse-mode="transform"
        :collapsed-width="0"
        :width="220"
        :native-scrollbar="false"
        class="bg-gray-50 h-full border-r border-gray-100"
      >
        <div class="h-full flex flex-col select-none">
          <div class="shrink-0" style="height: var(--immersive-safe-top, 48px)" data-window-drag></div>
          
          <div class="flex-1 overflow-y-auto pt-2 pb-4">
            <!-- Task Group -->
            <div class="mb-4">
            <div class="px-4 py-1.5 text-[12px] font-bold text-gray-400/80 uppercase tracking-wide">任务</div>
            <div class="px-2 space-y-1.5">
              <button 
                @click="switchView('list')"
                class="group w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all cursor-default relative"
                :class="currentView === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
              >
                <Download 
                  :size="15" 
                  stroke-width="2" 
                  class="transition-colors duration-200"
                  :class="currentView === 'list' ? 'text-white' : 'text-gray-500'"
                />
                <span class="truncate relative z-10">下载列表</span>
                <span v-if="tasks.length > 0" class="ml-auto text-[11px] font-medium opacity-90">
                  {{ tasks.length }}
                </span>
              </button>
            </div>
          </div>

          <!-- Create Group -->
          <div class="mb-4">
            <div class="px-4 py-1.5 text-[12px] font-bold text-gray-400/80 uppercase tracking-wide">新建</div>
            <div class="px-2 space-y-1.5">
              <button 
                @click="switchView('create-http')"
                class="group w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all cursor-default relative"
                :class="currentView === 'create-http' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
              >
                <Globe 
                  :size="15" 
                  stroke-width="2" 
                  class="transition-colors duration-200"
                  :class="currentView === 'create-http' ? 'text-white' : 'text-cyan-500'"
                />
                <span class="truncate relative z-10">HTTP 下载</span>
              </button>

              <button 
                @click="switchView('create-m3u8')"
                class="group w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all cursor-default relative"
                :class="currentView === 'create-m3u8' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
              >
                <FileVideo 
                  :size="15" 
                  stroke-width="2" 
                  class="transition-colors duration-200"
                  :class="currentView === 'create-m3u8' ? 'text-white' : 'text-purple-500'"
                />
                <span class="truncate relative z-10">M3U8 转 MP4</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      </n-layout-sider>

      <!-- Main Content -->
      <n-layout class="h-full bg-transparent flex flex-col min-w-0" :native-scrollbar="false">
        <!-- Header -->
        <div 
          class="flex items-center justify-between bg-white/60 backdrop-blur-xl border-b border-gray-100 z-30 shrink-0 absolute top-0 left-0 right-0 h-12 px-3 pr-32"
          data-window-drag
        >
          <div class="flex items-center gap-3 min-w-0">
            <h2 class="text-sm font-bold text-gray-800 truncate">
              {{ viewTitle }}
            </h2>
          </div>

          <div class="shrink-0 flex items-center gap-1">
            <template v-if="currentView === 'list'">
              <n-tooltip trigger="hover" placement="bottom">
                <template #trigger>
                  <n-button 
                    quaternary
                    circle
                    size="small"
                    @click="pauseAll" 
                    :disabled="!hasBusyTasks"
                    class="text-gray-500 hover:text-gray-900"
                  >
                    <template #icon>
                      <n-icon :size="18" :component="Pause" />
                    </template>
                  </n-button>
                </template>
                全部暂停
              </n-tooltip>

              <n-tooltip trigger="hover" placement="bottom">
                <template #trigger>
                  <n-button 
                    quaternary
                    circle
                    size="small"
                    @click="resumeAll" 
                    :disabled="!hasResumableTasks"
                    class="text-gray-500 hover:text-gray-900"
                  >
                    <template #icon>
                      <n-icon :size="18" :component="Play" />
                    </template>
                  </n-button>
                </template>
                全部继续
              </n-tooltip>

              <n-popselect
                v-model:value="clearPick"
                :options="clearOptions"
                trigger="click"
                placement="bottom-end"
                @update:value="handleClear"
              >
                <n-button 
                  quaternary
                  circle
                  size="small"
                  title="清理任务"
                  class="text-gray-500 hover:text-gray-900"
                >
                  <template #icon>
                    <n-icon :size="18" :component="Trash2" />
                  </template>
                </n-button>
              </n-popselect>

              <div class="w-px h-4 bg-gray-200 mx-1"></div>

              <n-tooltip trigger="hover" placement="bottom">
                <template #trigger>
                  <n-button 
                    quaternary
                    circle
                    size="small"
                    @click="refreshTasks(false)"
                    class="text-gray-500 hover:text-gray-900"
                  >
                    <template #icon>
                      <n-icon :size="18" :component="RefreshCw" :class="{ 'animate-spin': refreshing }" />
                    </template>
                  </n-button>
                </template>
                刷新列表
              </n-tooltip>
            </template>
          </div>
        </div>

        <!-- Content Area -->
        <n-layout-content
          class="flex-1 min-h-0 pt-12"
          content-style="display: flex; flex-direction: column; position: relative;"
          :native-scrollbar="false"
        >
          <div class="flex-1 min-h-0 overflow-y-auto bg-white relative">
          <!-- List View -->
          <div v-if="currentView === 'list'" class="p-4">
            <div v-if="tasks.length === 0" class="flex flex-col items-center justify-center text-slate-400 py-20">
              <div class="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-gray-100">
                <Download class="w-10 h-10 text-gray-300" stroke-width="1.5" />
              </div>
              <h3 class="text-gray-900 font-bold text-base mb-2">暂无任务</h3>
              <p class="text-sm text-gray-400 mb-6 text-center">当前没有下载任务</p>
              <button 
                @click="switchView('create-http')"
                class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm shadow-blue-200"
              >
                新建任务
              </button>
            </div>

            <div v-else class="space-y-3">
              <!-- Summary Bar at top of list (optional, keeps header clean) -->
              <div class="px-1 flex items-center justify-between text-[11px] text-gray-400 mb-2">
                 <span>{{ summaryText }}</span>
              </div>

              <div
                v-for="task in tasks"
                :key="task.id"
                class="rounded-xl border border-slate-200/60 bg-white p-4 hover:shadow-sm transition-shadow group relative overflow-hidden"
              >
                 <!-- Progress Background -->
                 <div 
                   v-if="progressPercent(task) > 0 && task.status === 'running'"
                   class="absolute bottom-0 left-0 h-0.5 bg-blue-500 transition-all duration-300"
                   :style="{ width: progressPercent(task) + '%' }"
                 ></div>

                <div class="flex items-start gap-3 relative z-10">
                  <div class="mt-1.5 w-2 h-2 rounded-full shrink-0" :class="statusDotClass(task.status)"></div>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <div class="text-[13px] font-semibold truncate text-gray-900" :title="primaryTitle(task)">
                          {{ primaryTitle(task) }}
                        </div>
                        <div class="text-[11px] text-slate-400 truncate font-mono mt-0.5" :title="task.url">
                          {{ task.url }}
                        </div>
                      </div>

                      <div class="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          v-if="['running', 'queued'].includes(task.status)"
                          @click="pauseTask(task)"
                          class="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                          title="暂停"
                        >
                          <Pause :size="14" />
                        </button>
                        <button
                          v-if="['paused', 'failed'].includes(task.status)"
                          @click="resumeTask(task)"
                          class="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                          title="继续"
                        >
                          <Play :size="14" />
                        </button>
                        <button
                          v-if="['running', 'queued', 'paused', 'failed'].includes(task.status)"
                          @click="cancelTask(task)"
                          class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="取消"
                        >
                          <X :size="14" />
                        </button>
                        <button
                          v-if="task.status === 'completed'"
                          @click="openDir(task.targetPath)"
                          class="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="打开所在文件夹"
                        >
                          <FolderOpen :size="14" />
                        </button>
                        <button
                          v-if="['completed', 'failed', 'canceled'].includes(task.status)"
                          @click="deleteTask(task)"
                          class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="删除记录"
                        >
                          <Trash2 :size="14" />
                        </button>
                      </div>
                    </div>

                    <div class="mt-2 flex items-center justify-between gap-3 text-[11px] text-slate-500">
                      <div class="flex items-center gap-2 min-w-0 flex-wrap">
                        <span class="shrink-0 px-1.5 py-0.5 rounded border" :class="statusBadgeClass(task.status)">
                          {{ statusLabel(task.status) }}
                        </span>
                        <span v-if="task.kind" class="shrink-0 px-1.5 py-0.5 rounded border bg-slate-50 text-slate-700 border-slate-200">
                          {{ kindLabel(task.kind, task.meta) }}
                        </span>
                        <span class="text-slate-400 tabular-nums shrink-0">
                          <template v-if="Number(task.totalBytes) > 0">
                            {{ formatBytes(task.downloadedBytes) }} / {{ formatBytes(task.totalBytes) }}
                          </template>
                          <template v-else>
                            {{ formatBytes(task.downloadedBytes) }}
                          </template>
                        </span>
                        <span v-if="task.status === 'running' && Number(task.speedBytesPerSec) > 0" class="text-slate-400 tabular-nums shrink-0">
                          {{ formatSpeed(task.speedBytesPerSec) }}
                        </span>
                        <span v-if="task.status === 'running' && task.etaSeconds !== null" class="text-slate-400 tabular-nums shrink-0">
                          {{ formatEta(task.etaSeconds) }}
                        </span>
                        <span v-if="Number(task.retryCount) > 0" class="text-slate-400 tabular-nums shrink-0">
                          {{ '重试 ' + task.retryCount }}
                        </span>
                        <span v-if="task.error" class="text-rose-600 truncate min-w-0 max-w-[200px]" :title="task.error">
                          {{ userFriendlyError(task.error) }}
                        </span>
                      </div>
                      <div v-if="progressPercent(task) > 0" class="text-slate-600 tabular-nums shrink-0">
                        {{ progressPercent(task) }}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Create View -->
          <div v-else class="p-8 max-w-2xl mx-auto">
             <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div class="flex items-center justify-between gap-3 mb-6">
                  <h3 class="text-lg font-bold text-gray-900">
                    {{ currentView === 'create-m3u8' ? 'M3U8 转 MP4' : 'HTTP 文件下载' }}
                  </h3>
                </div>

                <div v-if="currentView === 'create-m3u8'" class="mb-4 p-3 bg-amber-50 text-amber-800 text-xs rounded-lg border border-amber-100 flex items-start gap-2">
                  <n-icon class="mt-0.5"><AlertCircle /></n-icon>
                  <span>M3U8 转 MP4 仅支持输出到本地挂载目录，且仅支持单条链接。</span>
                </div>

                <div class="space-y-4">
                  <div>
                    <label class="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                      {{ currentView === 'create-m3u8' ? 'M3U8 链接' : '下载链接' }}
                    </label>
                    <n-input
                      v-model:value="createForm.url"
                      type="textarea"
                      :placeholder="currentView === 'create-m3u8' ? '粘贴 m3u8 链接' : '粘贴下载链接（支持多行）'"
                      :autosize="{ minRows: 3, maxRows: 8 }"
                      class="rounded-xl"
                    />
                    <div class="mt-2 flex justify-end">
                      <button 
                        @click="pasteUrl" 
                        class="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                      >
                        <Clipboard :size="12" />
                        <span>粘贴剪贴板内容</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label class="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">保存位置</label>
                    <n-input-group class="flex-1 min-w-0">
                      <n-input v-model:value="createForm.dirPath" readonly placeholder="/Downloads" />
                      <n-button ghost @click="pickDir">{{ '选择文件夹' }}</n-button>
                    </n-input-group>
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">文件名 (可选)</label>
                      <n-input
                        v-model:value="createForm.filename"
                        :placeholder="currentView === 'create-m3u8' ? '默认自动生成' : '仅单链接生效'"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">选项</label>
                      <div class="flex items-center gap-4 h-[34px]">
                        <n-checkbox v-model:checked="createForm.overwrite">{{ '覆盖已存在文件' }}</n-checkbox>
                        <button 
                          @click="toggleHeaders" 
                          class="flex items-center gap-1.5 text-xs font-medium transition-colors"
                          :class="showHeaders ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'"
                        >
                          <SlidersHorizontal :size="14" />
                          <span>高级设置</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div v-if="showHeaders" class="pt-2 border-t border-gray-100 animate-in fade-in slide-in-from-top-1">
                    <label class="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">自定义请求头 (JSON)</label>
                    <n-input
                      v-model:value="createForm.headersText"
                      type="textarea"
                      placeholder='{"Authorization":"Bearer token"}'
                      :autosize="{ minRows: 2, maxRows: 5 }"
                    />
                  </div>

                  <div class="pt-4 flex items-center justify-end gap-3">
                    <button 
                      @click="switchView('list')"
                      class="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                    >
                      取消
                    </button>
                    <button 
                      @click="submitCreateTask"
                      :disabled="!canSubmit || creating"
                      class="px-6 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95 flex items-center gap-2"
                    >
                      <n-icon v-if="creating" class="animate-spin"><RefreshCw /></n-icon>
                      <Download v-else :size="16" />
                      <span>开始下载</span>
                    </button>
                  </div>
                </div>
             </div>
          </div>
          </div>
        </n-layout-content>
      </n-layout>
    </n-layout>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import {
  RefreshCw,
  X,
  FolderOpen,
  Download,
  Clipboard,
  Pause,
  Play,
  Trash2,
  SlidersHorizontal,
  AlertCircle,
  Globe,
  FileVideo
} from 'lucide-vue-next';
import { NButton, NCheckbox, NIcon, NInput, NInputGroup, NPopselect, NLayout, NLayoutSider, NTooltip } from 'naive-ui';
import { useOs } from '@/os';

const os = useOs();
const api = os.api;
const { toast } = os.ui;

const currentView = ref('list'); // 'list' | 'create-http' | 'create-m3u8'
const tasks = ref([]);
const creating = ref(false);
const refreshing = ref(false);
const lastCompletedAt = ref(0);
const showHeaders = ref(false);
const clearPick = ref(null);

const createForm = ref({
  kind: 'http',
  url: '',
  dirPath: '/Downloads',
  filename: '',
  overwrite: false,
  headersText: ''
});

const viewTitle = computed(() => {
  if (currentView.value === 'list') return '下载列表';
  if (currentView.value === 'create-m3u8') return 'M3U8 转 MP4';
  return 'HTTP 下载';
});

const switchView = (view) => {
  currentView.value = view;
  if (view === 'create-http') {
    createForm.value.kind = 'http';
  } else if (view === 'create-m3u8') {
    createForm.value.kind = 'm3u8-to-mp4';
  }
};

const canSubmit = computed(() => {
  const raw = String(createForm.value.url || '').trim();
  return !!raw;
});

const hasBusyTasks = computed(() => (tasks.value || []).some((t) => ['queued', 'running'].includes(t?.status)));
const hasResumableTasks = computed(() => (tasks.value || []).some((t) => ['paused', 'failed'].includes(t?.status)));

const summaryText = computed(() => {
  const list = tasks.value || [];
  const running = list.filter((t) => t?.status === 'running').length;
  const queued = list.filter((t) => t?.status === 'queued').length;
  return `进行中 ${running + queued} / 已完成 ${list.filter((t) => t?.status === 'completed').length}`;
});

const clearOptions = [
  { label: '清理：完成/失败/取消', value: 'ended' },
  { label: '清理：仅完成', value: 'completed' },
  { label: '清理：仅失败', value: 'failed' },
  { label: '清理：仅取消', value: 'canceled' }
];

const refreshTasks = async (silent = false) => {
  if (refreshing.value) return;
  refreshing.value = true;
  try {
    const data = await api.downloaderListTasks();
    const list = Array.isArray(data) ? data : [];
    tasks.value = list.slice().sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0));
    
    const maxFinishedAt = list
      .filter(t => t?.status === 'completed')
      .reduce((max, t) => Math.max(max, Number(t?.finishedAt || 0)), 0);
      
    if (maxFinishedAt > lastCompletedAt.value) {
      lastCompletedAt.value = maxFinishedAt;
      os.files.triggerRefresh();
    }
  } catch (e) {
    if (!silent) toast.error('无法刷新任务列表');
  } finally {
    refreshing.value = false;
  }
};

const pasteUrl = async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) createForm.value.url = text;
  } catch (e) {
    toast.error('无法读取剪贴板');
  }
};

const pickDir = async () => {
  const current = createForm.value.dirPath || '/';
  await os.stores.windows.openFileSelector(
    (file) => {
      if (file?.path) createForm.value.dirPath = file.path;
    },
    { selectDirectory: true, initialPath: current, title: '选择保存位置' }
  );
};

const toggleHeaders = () => {
  showHeaders.value = !showHeaders.value;
};

const parseHeaders = () => {
  const raw = String(createForm.value.headersText || '').trim();
  if (!raw) return undefined;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    return obj;
  } catch {
    return null;
  }
};

const kindLabel = (kind, meta) => {
  const k = String(kind || '');
  if (k === 'm3u8-to-mp4') return 'M3U8→MP4';
  if (k === 'http') return 'HTTP';
  if (meta && typeof meta === 'object') return k;
  return k || 'HTTP';
};

const guessMp4Filename = (url) => {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const last = decodeURIComponent(parts[parts.length - 1] || '');
    const name = last.replace(/\.m3u8$/i, '').replace(/\.mp4$/i, '');
    if (name) return `${name}.mp4`;
  } catch {
    void 0;
  }
  return 'video.mp4';
};

const submitCreateTask = async () => {
  const rawText = createForm.value.url.trim();
  if (!rawText) return;

  const urls = rawText.split(/[\r\n]+/).map(u => u.trim()).filter(u => u);
  if (urls.length === 0) return;

  const validUrls = urls.filter(u => /^https?:\/\//i.test(u));
  if (validUrls.length === 0) {
    toast.error('未检测到有效的 http/https 链接');
    return;
  }

  const kind = String(createForm.value.kind || 'http');
  if (kind === 'm3u8-to-mp4' && validUrls.length > 1) {
    toast.warning('m3u8→mp4 仅支持单条链接，已取第一条');
  }

  if (validUrls.length < urls.length) {
    toast.warning(`已过滤 ${urls.length - validUrls.length} 个无效链接`);
  }

  creating.value = true;
  try {
    let successCount = 0;
    let failCount = 0;
    const headers = parseHeaders();
    if (headers === null) {
      toast.error('请求头 JSON 格式不正确');
      return;
    }
    const loopUrls = kind === 'm3u8-to-mp4' ? [validUrls[0]] : validUrls;
    for (const url of loopUrls) {
      const rawFilename = String(createForm.value.filename || '').trim();
      const filename =
        kind === 'm3u8-to-mp4'
          ? (rawFilename ? (rawFilename.toLowerCase().endsWith('.mp4') ? rawFilename : `${rawFilename}.mp4`) : guessMp4Filename(url))
          : (validUrls.length === 1 ? (rawFilename || undefined) : undefined);

      const body = {
        url,
        dirPath: createForm.value.dirPath,
        filename,
        overwrite: createForm.value.overwrite,
        headers: headers || undefined
      };

      try {
        if (kind === 'm3u8-to-mp4') {
          await api.downloaderCreateM3u8ToMp4Task(body);
        } else {
          await api.downloaderCreateTask(body);
        }
        successCount++;
      } catch (e) {
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`已创建 ${successCount} 个任务`);
      createForm.value.url = '';
      createForm.value.filename = '';
      createForm.value.headersText = '';
      currentView.value = 'list';
      await refreshTasks(true);
    } else {
      toast.error('任务创建失败');
    }
    if (failCount > 0) toast.warning(`失败 ${failCount} 个链接`);
  } catch (e) {
    toast.error(e.message || '创建任务失败');
  } finally {
    creating.value = false;
  }
};

const cancelTask = async (task) => {
  if (!task?.id) return;
  try {
    await api.downloaderCancelTask(task.id);
    toast.success('已取消');
    refreshTasks(true);
  } catch (e) {
    toast.error('取消失败');
  }
};

const pauseTask = async (task) => {
  if (!task?.id) return;
  try {
    await api.downloaderPauseTask(task.id);
    refreshTasks(true);
  } catch (e) {
    toast.error('暂停失败');
  }
};

const resumeTask = async (task) => {
  if (!task?.id) return;
  try {
    await api.downloaderResumeTask(task.id);
    refreshTasks(true);
  } catch (e) {
    toast.error('继续失败');
  }
};

const deleteTask = async (task) => {
  if (!task?.id) return;
  try {
    await api.downloaderDeleteTask(task.id);
    refreshTasks(true);
  } catch (e) {
    toast.error('删除失败');
  }
};

const openDir = (path) => {
  if (!path) return;
  const dir = path.substring(0, path.lastIndexOf('/')) || '/';
  os.stores.windows.openFile({ type: 'directory', path: dir });
};

const formatBytes = (bytes) => {
  const n = Number(bytes || 0);
  if (n === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return parseFloat((n / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatSpeed = (bytesPerSec) => `${formatBytes(bytesPerSec)}/s`;

const formatEta = (seconds) => {
  const s = Math.max(0, Math.floor(Number(seconds || 0)));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};

const progressPercent = (task) => {
  if (!task.totalBytes) return 0;
  const p = Math.round((task.downloadedBytes / task.totalBytes) * 100);
  return Math.min(100, Math.max(0, p));
};

const statusLabel = (status) => {
  const map = {
    queued: '等待中',
    running: '下载中',
    paused: '已暂停',
    completed: '已完成',
    failed: '失败',
    canceled: '已取消'
  };
  return map[status] || status;
};

const statusBadgeClass = (status) => {
  if (status === 'completed') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'failed') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'canceled') return 'bg-gray-50 text-gray-600 border-gray-200';
  if (status === 'queued') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'paused') return 'bg-slate-50 text-slate-700 border-slate-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
};

const statusDotClass = (status) => {
  if (status === 'completed') return 'bg-green-500';
  if (status === 'failed') return 'bg-red-500';
  if (status === 'canceled') return 'bg-gray-500';
  if (status === 'queued') return 'bg-amber-500';
  if (status === 'paused') return 'bg-slate-500';
  return 'bg-blue-500';
};

const primaryTitle = (task) => {
  if (task.filename) return task.filename;
  if (task.url) {
    try {
      const url = new URL(task.url);
      const parts = url.pathname.split('/');
      const last = parts[parts.length - 1];
      if (last) return decodeURIComponent(last);
    } catch (e) {
      void e;
    }
  }
  return '未命名任务';
};

const userFriendlyError = (msg) => {
  if (!msg) return '';
  if (msg.includes('404')) return '文件不存在 (404)';
  if (msg.includes('403')) return '无权访问 (403)';
  if (msg.includes('network')) return '网络错误';
  return msg;
};

const pauseAll = async () => {
  if (!hasBusyTasks.value) return;
  try {
    await api.downloaderPauseAllTasks();
    refreshTasks(true);
  } catch (e) {
    toast.error('全部暂停失败');
  }
};

const resumeAll = async () => {
  if (!hasResumableTasks.value) return;
  try {
    await api.downloaderResumeAllTasks();
    refreshTasks(true);
  } catch (e) {
    toast.error('全部继续失败');
  }
};

const handleClear = async (value) => {
  const v = String(value || '');
  clearPick.value = null;
  const statuses =
    v === 'completed' ? ['completed'] :
    v === 'failed' ? ['failed'] :
    v === 'canceled' ? ['canceled'] :
    ['completed', 'failed', 'canceled'];
  try {
    await api.downloaderClearTasks({ statuses });
    refreshTasks(true);
  } catch (e) {
    toast.error('清理失败');
  }
};

let timer = null;
const startPolling = () => {
  const loop = async () => {
    if (document.visibilityState === 'visible') {
      await refreshTasks(true);
    }
    const interval = hasBusyTasks.value ? 1500 : 8000;
    timer = window.setTimeout(loop, interval);
  };
  timer = window.setTimeout(loop, 0);
};

onMounted(() => {
  refreshTasks();
  startPolling();
});

onBeforeUnmount(() => {
  if (timer) window.clearTimeout(timer);
});
</script>
