<template>
  <div v-if="!hasSource" class="h-full w-full bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-8" data-window-drag>
    <div class="w-full max-w-xl text-center">
      <div class="mx-auto w-14 h-14 rounded-2xl bg-violet-50 text-violet-700 flex items-center justify-center">
        <FileSearch :size="24" />
      </div>
      <div class="mt-4 text-xl font-semibold text-slate-900">{{ '文档预览' }}</div>
      <div class="mt-2 text-sm text-slate-500 leading-relaxed">
        {{ '选择文件后可直接预览 PDF / Office / Markdown / Excel / HTML。' }}
      </div>
      <div class="mt-5 flex items-center justify-center">
        <button
          type="button"
          class="h-10 px-5 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 active:bg-violet-800 transition-colors"
          @click="pickFile"
        >
          {{ '选择文件' }}
        </button>
      </div>
      <div class="mt-3 text-xs text-slate-400">
        {{ '也可以从文件管理器双击打开。' }}
      </div>
    </div>
  </div>

  <div v-else ref="rootRef" class="h-full w-full flex flex-col bg-gradient-to-b from-slate-50 to-white" data-window-drag>
    <div class="flex-1 min-h-0 p-4">
      <div class="relative h-full rounded-2xl bg-white/60 backdrop-blur-xl border border-white/40 shadow-[0_10px_30px_rgba(15,23,42,0.06)] overflow-hidden">
        <div v-if="loading && viewType !== 'html'" class="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-sm">
          <n-spin size="medium" />
        </div>

        <div v-if="error" class="absolute inset-0 z-20 flex items-center justify-center text-center px-6">
          <div class="text-sm text-slate-600">{{ error }}</div>
        </div>

        <div v-if="viewType === 'html'" class="h-full w-full bg-white flex flex-col">
           <iframe
            :src="resolvedHtmlUrl"
            class="flex-1 w-full border-none"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-fullscreen"
            allowfullscreen
            title="HTML Preview"
          ></iframe>
          <div class="h-10 flex items-center justify-end px-4 gap-2 bg-gray-50/70 backdrop-blur border-t border-gray-100 flex-shrink-0">
            <a
              :href="resolvedHtmlUrl"
              target="_blank"
              class="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
            >
              <n-icon :size="14"><ExternalLink /></n-icon>
              {{ '在浏览器中打开' }}
            </a>
          </div>
        </div>

        <div v-else-if="viewType === 'pdf'" class="h-full w-full">
          <iframe v-if="previewUrl" :src="previewUrl" class="w-full h-full border-none block bg-white" allowfullscreen></iframe>
          <div v-else class="h-full w-full flex items-center justify-center text-slate-400 text-sm">
            {{ '无法预览' }}
          </div>
        </div>

        <div v-else-if="viewType === 'docx'" class="h-full w-full overflow-y-auto">
          <div class="mx-auto max-w-4xl px-4 py-8">
            <div ref="docxContainer" class="docx-container rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden min-h-[60vh]"></div>
          </div>
        </div>

        <div v-else-if="viewType === 'pptx'" class="h-full w-full overflow-auto">
          <div class="min-h-full flex justify-center p-5">
            <div ref="pptxContainer" class="w-full max-w-[1100px]"></div>
          </div>
        </div>

        <div v-else-if="viewType === 'markdown'" class="h-full w-full overflow-y-auto">
          <div
            class="prose prose-slate max-w-4xl mx-auto px-4 py-6 prose-pre:bg-slate-900 prose-pre:text-white prose-pre:rounded-xl prose-pre:text-xs prose-pre:leading-relaxed prose-pre:overflow-auto prose-code:font-mono prose-code:before:content-none prose-code:after:content-none"
            v-html="markdownHtml"
          ></div>
        </div>

        <div v-else-if="viewType === 'excel'" class="h-full w-full overflow-auto">
          <div class="min-w-full">
            <table class="w-full border-separate border-spacing-0 text-xs">
              <thead class="sticky top-0 z-10">
                <tr>
                  <th class="sticky left-0 z-20 bg-slate-50/90 backdrop-blur border-b border-slate-200 px-3 py-2 text-slate-500 font-semibold w-12">
                    {{ '#' }}
                  </th>
                  <th
                    v-for="col in displayColumns"
                    :key="col.key"
                    class="bg-slate-50/90 backdrop-blur border-b border-slate-200 px-3 py-2 text-left text-slate-500 font-semibold whitespace-nowrap"
                  >
                    {{ col.label }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, rIndex) in displayRows" :key="rIndex" class="hover:bg-slate-50/70">
                  <td class="sticky left-0 bg-white/90 backdrop-blur border-b border-slate-100 px-3 py-2 text-slate-400 font-medium w-12">
                    {{ rIndex + 1 }}
                  </td>
                  <td
                    v-for="col in displayColumns"
                    :key="col.key"
                    class="border-b border-slate-100 px-3 py-2 text-slate-800 max-w-[320px] truncate"
                  >
                    {{ formatCell(row?.[col.index]) }}
                  </td>
                </tr>
              </tbody>
            </table>

            <div v-if="!loading && displayRows.length === 0" class="h-[50vh] flex items-center justify-center text-slate-400 text-sm">
              {{ '空表格' }}
            </div>
          </div>
        </div>

        <div v-else-if="viewType === 'doc'" class="h-full w-full flex items-center justify-center text-slate-500 text-sm px-6 text-center">
          {{ '暂不支持预览 .doc，请转换为 .docx' }}
        </div>

        <div v-else-if="viewType === 'ppt'" class="h-full w-full flex items-center justify-center text-slate-500 text-sm px-6 text-center">
          {{ '暂不支持预览 .ppt，请转换为 .pptx' }}
        </div>

        <div v-else class="h-full w-full flex items-center justify-center text-slate-500 text-sm">
          {{ '不支持的文件类型' }}
        </div>

        <div
          v-if="viewType === 'excel' && previewLimitHint"
          class="absolute bottom-3 right-3 z-10 rounded-full bg-white/80 backdrop-blur border border-white/50 px-3 py-1 text-[11px] text-slate-600 shadow-sm"
        >
          {{ previewLimitHint }}
        </div>
      </div>
    </div>

    <div class="h-12 flex-shrink-0 px-2 flex items-center justify-end gap-2 border-t border-white/40 bg-white/70 backdrop-blur">
      <button
        class="h-9 w-9 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-900"
        @click="toggleFullscreen"
      >
        <Minimize2 v-if="isFullscreen" :size="18" />
        <Maximize2 v-else :size="18" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue';
import { marked } from 'marked';
import { NSpin, NIcon } from 'naive-ui';
import { FileSearch, Maximize2, Minimize2, ExternalLink } from 'lucide-vue-next';
import { reopenCurrentAppWindow, useOs } from '@/os';

const os = useOs();
const api = os.api;

const props = defineProps({
  files: { type: Array, default: () => [] },
  componentProps: { type: Object, default: () => ({}) }
});

const loading = ref(true);
const error = ref('');
const docxContainer = ref(null);
const pptxContainer = ref(null);
const objectUrl = ref('');
const previewUrl = ref('');
const loadSeq = ref(0);
const markdownHtml = ref('');
const resolvedType = ref('');
const rootRef = ref(null);
const isFullscreen = ref(false);

// Excel state
const workbook = ref(null);
const sheetNames = ref([]);
const activeSheet = ref('');
const sheetData = ref([]);
let xlsxModule = null;
let pptxPreviewer = null;
let pptxModule = null;

const target = computed(() => (Array.isArray(props.files) ? props.files[0] : null));
const hasFile = computed(() => !!target.value?.path);
const path = computed(() => target.value?.path || '');
const name = computed(() => String(path.value || '').split('/').filter(Boolean).pop() || '');

const url = computed(() => String(props.componentProps?.url || '').trim());
const hasUrl = computed(() => !!url.value);
const hasSource = computed(() => hasFile.value || hasUrl.value);

const resolvedHtmlUrl = computed(() => {
  if (hasUrl.value) return url.value;
  if (path.value && (type.value === 'html')) {
    return String(api.getFileUrl(path.value) || '');
  }
  return '';
});

const type = computed(() => {
  if (hasUrl.value) return 'html';
  const lower = name.value.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
  if (lower.endsWith('.docx')) return 'docx';
  if (lower.endsWith('.doc')) return 'doc';
  if (lower.endsWith('.pptx')) return 'pptx';
  if (lower.endsWith('.ppt')) return 'ppt';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) return 'excel';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  return 'unknown';
});

const viewType = computed(() => resolvedType.value || type.value);

const MAX_PREVIEW_ROWS = 200;
const MAX_PREVIEW_COLS = 50;

const displayRows = computed(() => {
  const rows = Array.isArray(sheetData.value) ? sheetData.value : [];
  return rows.slice(0, MAX_PREVIEW_ROWS);
});

const displayColCount = computed(() => {
  let maxCols = 0;
  for (const row of displayRows.value) {
    if (Array.isArray(row)) maxCols = Math.max(maxCols, row.length);
    if (maxCols >= MAX_PREVIEW_COLS) break;
  }
  return Math.min(maxCols, MAX_PREVIEW_COLS);
});

const toColumnName = (index) => {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

const displayColumns = computed(() => {
  const count = displayColCount.value;
  return Array.from({ length: count }, (_, index) => ({
    index,
    label: toColumnName(index),
    key: `${index}`
  }));
});

const previewLimitHint = computed(() => {
  const totalRows = Array.isArray(sheetData.value) ? sheetData.value.length : 0;
  const limitedRows = totalRows > MAX_PREVIEW_ROWS;
  const limitedCols =
    displayColCount.value >= MAX_PREVIEW_COLS &&
    displayRows.value.some((r) => Array.isArray(r) && r.length > MAX_PREVIEW_COLS);

  if (!limitedRows && !limitedCols) return '';

  const rowText = limitedRows ? `${MAX_PREVIEW_ROWS} 行` : '';
  const colText = limitedCols ? `${MAX_PREVIEW_COLS} 列` : '';
  return `仅预览前 ${[rowText, colText].filter(Boolean).join(' / ')}`;
});

const syncFullscreen = () => {
  const el = rootRef.value;
  isFullscreen.value = !!(el && document.fullscreenElement === el);
};

const closeSelf = () => {
  os.window.close();
};

const pickFile = () => {
  os.stores.windows.openFileSelector?.((selectedFile) => {
    if (!selectedFile) return;
    reopenCurrentAppWindow(os, {
      title: selectedFile.name || selectedFile.path,
      componentProps: { files: [selectedFile] }
    });
    closeSelf();
  }, { allowedTypes: ['pdf', 'docx', 'pptx', 'xlsx', 'xls', 'csv', 'md', 'markdown', 'html', 'htm'] });
};

const toggleFullscreen = async () => {
  const el = rootRef.value;
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    if (!el?.requestFullscreen) return;
    await el.requestFullscreen();
  } catch {
    void 0;
  }
};

const revokeObjectUrl = () => {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value);
    objectUrl.value = '';
  }
  previewUrl.value = '';
};

const resetViewState = () => {
  error.value = '';
  workbook.value = null;
  sheetNames.value = [];
  activeSheet.value = '';
  sheetData.value = [];
  if (docxContainer.value) docxContainer.value.innerHTML = '';
  if (pptxContainer.value) pptxContainer.value.innerHTML = '';
  pptxPreviewer = null;
  markdownHtml.value = '';
  resolvedType.value = '';
  revokeObjectUrl();
};

const formatCell = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  try {
    return JSON.stringify(value);
  } catch (e) {
    return String(value);
  }
};

const loadContent = async () => {
  const seq = (loadSeq.value += 1);
  loading.value = true;

  try {
    if (!path.value) {
      resetViewState();
      return;
    }

    resetViewState();

    const baseType = type.value;

    if (baseType === 'unknown') {
      return;
    }

    if (baseType === 'html') {
      return;
    }

    if (baseType === 'markdown') {
      const data = await api.getFileContent(path.value);
      if (seq !== loadSeq.value) return;
      markdownHtml.value = marked.parse(typeof data === 'string' ? data : String(data ?? ''));
      return;
    }

    const raw = await api.getFileContent(path.value, { responseType: 'blob' });
    if (seq !== loadSeq.value) return;

    const blob = raw instanceof Blob ? raw : new Blob([raw]);

    let effectiveType = baseType;
    if (baseType === 'doc' || baseType === 'ppt') {
      const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
      const isZip = head[0] === 0x50 && head[1] === 0x4b;
      if (!isZip) return;
      effectiveType = baseType === 'doc' ? 'docx' : 'pptx';
      resolvedType.value = effectiveType;
    }

    if (effectiveType === 'pdf') {
      const nextUrl = URL.createObjectURL(blob);
      objectUrl.value = nextUrl;
      previewUrl.value = nextUrl;
      return;
    }

    if (effectiveType === 'docx') {
      if (!docxContainer.value) return;
      const { renderAsync } = await import('docx-preview');
      if (seq !== loadSeq.value) return;
      docxContainer.value.innerHTML = '';
      await renderAsync(blob, docxContainer.value, null, { className: 'docx', inWrapper: false });
      return;
    }

    if (effectiveType === 'pptx') {
      await nextTick();
      if (!pptxContainer.value) return;
      pptxContainer.value.innerHTML = '';
      const arrayBuffer = await blob.arrayBuffer();
      if (seq !== loadSeq.value) return;
      if (!pptxModule) pptxModule = await import('pptx-preview');
      if (seq !== loadSeq.value) return;
      pptxPreviewer = pptxModule.init(pptxContainer.value, { width: 960, height: 540 });
      pptxPreviewer.preview(arrayBuffer);
      return;
    }

    if (effectiveType === 'excel') {
      const arrayBuffer = await blob.arrayBuffer();
      if (seq !== loadSeq.value) return;
      if (!xlsxModule) xlsxModule = await import('xlsx');
      if (seq !== loadSeq.value) return;
      const wb = xlsxModule.read(arrayBuffer, { type: 'array' });
      workbook.value = wb;
      sheetNames.value = Array.isArray(wb?.SheetNames) ? wb.SheetNames : [];
      if (sheetNames.value.length > 0) selectSheet(sheetNames.value[0]);
      return;
    }
  } catch (e) {
    error.value = '文档加载失败';
  } finally {
    if (seq === loadSeq.value) loading.value = false;
  }
};

const selectSheet = (name) => {
  if (!workbook.value || !xlsxModule) return;
  activeSheet.value = name;
  const ws = workbook.value.Sheets?.[name];
  if (!ws) {
    sheetData.value = [];
    return;
  }
  const data = xlsxModule.utils.sheet_to_json(ws, { header: 1 });
  sheetData.value = data || [];
};

onMounted(() => {
  loadContent();
  document.addEventListener('fullscreenchange', syncFullscreen);
  syncFullscreen();
});

watch(() => path.value, () => {
  loadContent();
});

onBeforeUnmount(() => {
  revokeObjectUrl();
  document.removeEventListener('fullscreenchange', syncFullscreen);
});
</script>

<style scoped>
.docx-container :deep(.docx-wrapper) {
  background: white;
}

.docx-container :deep(.docx) {
  padding: 24px;
}

.docx-container :deep(table) {
  max-width: 100%;
}
</style>
