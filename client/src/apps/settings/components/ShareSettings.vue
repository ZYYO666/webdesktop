<template>
  <div class="h-full flex flex-col">
    <div class="flex-1 overflow-y-auto px-6 py-6 md:px-8 md:py-8">
      <div class="max-w-[880px] mx-auto space-y-6 md:space-y-8">
        <div class="flex items-center justify-between">
          <h2 class="text-base md:text-lg font-semibold text-gray-900">{{ '文件共享' }}</h2>
          <n-button quaternary circle size="small" @click="fetchShares" :loading='loading'>
            <template #icon><n-icon :component="RefreshCw" /></template>
          </n-button>
        </div>

        <p class="text-sm text-gray-600 leading-relaxed">
          {{ '管理已创建的文件共享链接。' }}
        </p>

        <div v-if="shares.length > 0" class="space-y-4">
          <n-card v-for="share in shares" :key="share.id" size="small" hoverable>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3 overflow-hidden mr-4">
                <n-tag :bordered="false" type='info' size="small" class="font-mono">
                  {{ share.id }}
                </n-tag>
                <span class="font-bold text-gray-900 truncate" :title="share.file_path">
                  {{ getFileName(share.file_path) }}
                </span>
                <div
                  v-if="share.downloads > 0"
                  class="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-xs font-medium text-gray-600"
                >
                  {{ share.downloads }}
                </div>
                <span class="text-xs text-gray-400">
                  {{ '创建于' }}: {{ formatDate(share.created_at) }}
                </span>
              </div>
              <div class="flex gap-2">
                <n-button size="small" quaternary circle @click="copyLink(share.id)">
                  <template #icon><Copy :size="16" /></template>
                </n-button>
                <n-button size="small" quaternary circle type='error' @click="handleDelete(share.id)">
                  <template #icon><Trash2 :size="16" /></template>
                </n-button>
              </div>
            </div>
          </n-card>
        </div>
        <div v-else class="text-center py-12 space-y-2">
          <n-empty :description="'暂无共享'" />
          <p class="text-xs text-gray-400">{{ '右键点击文件选择“创建链接”来共享文件' }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Copy, Trash2, RefreshCw } from 'lucide-vue-next';
import { useOs } from '@/os';

const os = useOs();
const api = os.api;
const toast = os.ui.toast;
const dialog = os.ui.dialog;
const copyToClipboard = os.ui.copyToClipboard;

const shares = ref([]);
const loading = ref(false);

const fetchShares = async () => {
  loading.value = true;
  try {
    const data = await api.getShares();
    shares.value = Array.isArray(data) ? data : [];
  } catch (e) {
    toast?.error?.(e?.message || '获取数据失败');
    shares.value = [];
  } finally {
    loading.value = false;
  }
};

const handleDelete = async (id) => {
  const ok = await dialog?.confirm?.('确定要取消此共享吗？');
  if (!ok) return;
  try {
    await api.deleteShare(id);
    toast?.success?.('删除成功');
    fetchShares();
  } catch (e) {
    toast?.error?.(e?.message || '删除失败');
  }
};

const getFileName = (path) => {
  return path.split('/').pop();
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString();
};

const copyLink = async (id) => {
  const link = `${window.location.origin}/s/${id}`;
  try {
    if (typeof copyToClipboard === 'function') await copyToClipboard(link);
    toast?.success?.('链接已复制');
  } catch (e) {
    toast?.error?.(e?.message || '复制失败');
  }
};

onMounted(() => {
  fetchShares();
});
</script>
