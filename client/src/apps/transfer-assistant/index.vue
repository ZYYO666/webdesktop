<template>
  <div class="h-full w-full bg-white text-gray-900 relative overflow-hidden">
    <div
      class="flex items-center justify-between bg-white/60 backdrop-blur-xl border-b border-gray-100 z-30 flex-shrink-0 absolute top-0 left-0 right-0 h-12 px-3 pr-32"
      data-window-drag
    >
      <div class="text-[14px] font-semibold text-gray-900">文本传输助手</div>
      <div class="flex items-center gap-1.5">
          <n-button quaternary circle size="small" class="text-gray-500 hover:text-gray-900" @click="startCreate">
            <Plus :size="18" />
          </n-button>
          <n-button
            quaternary
            circle
            size="small"
            class="text-gray-500 hover:text-gray-900"
            @click="clearAll"
            :disabled="items.length === 0"
          >
            <Trash2 :size="18" />
          </n-button>
        </div>
    </div>

    <div class="flex-1 min-h-0 bg-slate-50/60 pt-12">
      <n-scrollbar content-style="padding: 16px 18px;">
        <div v-if="loading" class="text-sm text-gray-500 px-2 py-6">加载中...</div>
        <n-empty v-else-if="items.length === 0 && !creating" description="暂无记录" />
        <div v-else class="flex flex-col gap-4">
          <div
            v-if="creating"
            class="border border-blue-100 rounded-2xl p-4 bg-white shadow-sm"
          >
            <div class="text-[11px] text-gray-400">新建</div>
            <n-input
              v-model:value="createDraft"
              type="textarea"
              placeholder="输入要传输的文本"
              class="mt-2"
              :autosize="{ minRows: 4, maxRows: 10 }"
              @blur="handleCreateBlur"
            />
            <div class="mt-3 flex items-center justify-between">
              <div class="text-xs text-gray-400">{{ createDraft.length }} 字</div>
              <div class="flex items-center gap-2 text-xs text-gray-500">
                <button class="hover:text-gray-900 transition-colors" type="button" @mousedown="markIgnoreBlur" @click="copyCreate">复制</button>
              </div>
            </div>
          </div>

          <div
            v-for="item in items"
            :key="item.id"
            class="border border-gray-100 rounded-2xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
          >
            <div class="flex items-center justify-between">
              <div class="text-[11px] text-gray-400">{{ formatTime(item.createdAt) }}</div>
              <div class="flex items-center gap-2 text-xs text-gray-500">
                <button class="hover:text-gray-900 transition-colors" type="button" @click="copyItem(item)">复制</button>
                <button class="hover:text-gray-900 transition-colors" type="button" @click="startEdit(item)">编辑</button>
                <button class="hover:text-red-600 transition-colors" type="button" @click="removeItem(item.id)">删除</button>
              </div>
            </div>

            <div v-if="editId === item.id" class="mt-3">
              <n-input
                v-model:value="editDraft"
                type="textarea"
                placeholder="编辑文本"
                :autosize="{ minRows: 4, maxRows: 10 }"
                @blur="handleEditBlur"
              />
              <div class="mt-3 flex items-center justify-between">
                <div class="text-xs text-gray-400">{{ editDraft.length }} 字</div>
                <div class="flex items-center gap-2 text-xs text-gray-500">
                  <button class="hover:text-gray-900 transition-colors" type="button" @mousedown="markIgnoreBlur" @click="copyEdit">复制</button>
                </div>
              </div>
            </div>

            <div v-else class="text-[13px] text-gray-800 whitespace-pre-wrap break-words mt-3 leading-relaxed">
              {{ item.text }}
            </div>
          </div>
        </div>
      </n-scrollbar>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { NButton, NEmpty, NInput, NScrollbar } from 'naive-ui';
import { Plus, Trash2 } from 'lucide-vue-next';
import { useOs } from '@/os';

const os = useOs();
const { toast, dialog, copyToClipboard } = os.ui;

const loading = ref(true);
const saving = ref(false);
const items = ref([]);
const creating = ref(false);
const createDraft = ref('');
const editId = ref(null);
const editDraft = ref('');
const ignoreBlur = ref(false);

const MAX_ITEMS = 200;

const extractValue = (payload) => {
  if (payload && typeof payload === 'object' && 'value' in payload) return payload.value;
  return payload;
};

const normalizeItems = (payload) => {
  const list = Array.isArray(payload) ? payload : [];
  return list
    .filter((item) => item && typeof item.text === 'string')
    .map((item) => ({
      id: String(item.id || `${item.createdAt || Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      text: String(item.text || ''),
      createdAt: Number(item.createdAt || Date.now()),
    }))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_ITEMS);
};

const formatTime = (ts) => {
  const n = Number(ts);
  if (!Number.isFinite(n)) return '';
  return new Date(n).toLocaleString();
};

const loadData = async () => {
  loading.value = true;
  try {
    const itemsRes = await os.appData.get('items');
    items.value = normalizeItems(extractValue(itemsRes));
  } catch (err) {
    toast.error('加载失败');
  } finally {
    loading.value = false;
  }
};

const persistItems = async (next) => {
  saving.value = true;
  try {
    await os.appData.set('items', next);
  } catch (err) {
    toast.error('保存失败');
  } finally {
    saving.value = false;
  }
};

const markIgnoreBlur = () => {
  ignoreBlur.value = true;
  setTimeout(() => {
    ignoreBlur.value = false;
  }, 0);
};

const copyItem = async (item) => {
  try {
    await copyToClipboard(String(item?.text || ''));
    toast.success('已复制');
  } catch (err) {
    toast.error('复制失败');
  }
};

const startCreate = () => {
  creating.value = true;
  createDraft.value = '';
  editId.value = null;
  editDraft.value = '';
};

const cancelCreate = () => {
  creating.value = false;
  createDraft.value = '';
};

const saveCreate = async () => {
  const text = String(createDraft.value || '').trim();
  if (!text) {
    toast.info('请输入内容');
    return;
  }
  const next = [
    { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text, createdAt: Date.now() },
    ...items.value,
  ].slice(0, MAX_ITEMS);
  items.value = next;
  creating.value = false;
  createDraft.value = '';
  await persistItems(next);
  toast.success('已保存');
};

const handleCreateBlur = () => {
  if (ignoreBlur.value) return;
  if (!creating.value) return;
  const text = String(createDraft.value || '').trim();
  if (text) {
    saveCreate();
    return;
  }
  cancelCreate();
};

const copyCreate = async () => {
  if (!createDraft.value.trim()) return;
  try {
    await copyToClipboard(String(createDraft.value || ''));
    toast.success('已复制');
  } catch (err) {
    toast.error('复制失败');
  }
};

const startEdit = (item) => {
  if (!item) return;
  editId.value = item.id;
  editDraft.value = String(item.text || '');
  creating.value = false;
  createDraft.value = '';
};

const cancelEdit = () => {
  editId.value = null;
  editDraft.value = '';
};

const saveEdit = async (id) => {
  const text = String(editDraft.value || '').trim();
  if (!text) {
    toast.info('请输入内容');
    return;
  }
  const updatedAt = Date.now();
  const next = [
    { id, text, createdAt: updatedAt },
    ...items.value.filter((item) => item.id !== id),
  ].slice(0, MAX_ITEMS);
  items.value = next;
  editId.value = null;
  editDraft.value = '';
  await persistItems(next);
  toast.success('已保存');
};

const handleEditBlur = () => {
  if (ignoreBlur.value) return;
  if (!editId.value) return;
  const text = String(editDraft.value || '').trim();
  if (text) {
    saveEdit(editId.value);
    return;
  }
  cancelEdit();
};

const copyEdit = async () => {
  if (!editDraft.value.trim()) return;
  try {
    await copyToClipboard(String(editDraft.value || ''));
    toast.success('已复制');
  } catch (err) {
    toast.error('复制失败');
  }
};

const removeItem = async (id) => {
  const next = items.value.filter((item) => item.id !== id);
  items.value = next;
  if (editId.value === id) {
    editId.value = null;
    editDraft.value = '';
  }
  await persistItems(next);
};

const clearAll = async () => {
  if (items.value.length === 0) return;
  const ok = await dialog.confirm('确认清空所有记录？');
  if (!ok) return;
  items.value = [];
  creating.value = false;
  createDraft.value = '';
  editId.value = null;
  editDraft.value = '';
  await persistItems([]);
};

onMounted(loadData);
</script>
