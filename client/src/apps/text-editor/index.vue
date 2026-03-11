<template>
  <div v-if="!hasFile" class="h-full w-full bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-8 relative">
    <div class="absolute top-0 left-0 right-0 h-12" data-window-drag></div>
    <div class="w-full max-w-xl text-center">
      <div class="mx-auto w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
        <FileText :size="24" />
      </div>
      <div class="mt-4 text-xl font-semibold text-slate-900">{{ '打开文本开始编辑' }}</div>
      <div class="mt-2 text-sm text-slate-500 leading-relaxed">
        {{ '支持大文件快速打开、自动缩进与快捷保存。' }}
      </div>
      <div class="mt-5 flex items-center justify-center">
        <button
          type="button"
          class="h-10 px-5 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 active:bg-amber-800 transition-colors"
          @click="pickFile"
        >
          {{ '选择文件' }}
        </button>
      </div>
      <div class="mt-3 text-xs text-slate-400">
        {{ '快捷键：Ctrl/⌘ + S 保存；Tab 缩进。' }}
      </div>
    </div>
  </div>

  <div v-else class="h-full w-full flex flex-col bg-white text-gray-900 relative">
    <div 
      class="h-12 flex items-center justify-between px-4 border-b border-gray-100 bg-white/80 backdrop-blur-xl absolute top-0 left-0 right-0 z-20"
      data-window-drag
    >
      <div class="min-w-0 flex items-center gap-3">
        <div class="min-w-0 flex items-center gap-2 text-[10px] text-gray-500 font-mono truncate">
          <span v-if="isDirty" class="font-sans text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">{{ `未保存` }}</span>
          <span>{{ formatBytes(fileSize || 0) }}</span>
          <span class="mx-2">·</span>
          <span class="uppercase">{{ language }}</span>
          <span v-if="displayPath" class="mx-2">·</span>
          <span v-if="displayPath">{{ displayPath }}</span>
        </div>
      </div>

      <div class="flex items-center gap-2 pr-32">
        <button
          type="button"
          class="h-7 px-3 rounded-lg text-xs font-medium border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
          @click="toggleWrap"
        >
          {{ wrap ? `自动换行` : `不换行` }}
        </button>
        <button
          type="button"
          class="h-7 px-3 rounded-lg text-xs font-medium border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
          @click="toggleTheme"
        >
          {{ isDark ? `深色` : `浅色` }}
        </button>
        <button
          class="h-7 px-3 rounded-lg text-xs font-medium border border-gray-200 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-gray-50 transition-colors"
          :disabled="!isDirty || isSaving || loading"
          @click="save"
        >
          {{ isSaving ? `保存中...` : `保存` }}
        </button>
      </div>
    </div>

    <div class="flex-1 min-h-0 relative pt-12">
      <div v-if="!loading" class="h-full w-full">
        <div ref="editorHostRef" class="h-full w-full"></div>
      </div>

      <div v-else class="absolute inset-0 flex items-center justify-center">
        <div class="flex items-center gap-3 text-gray-500">
          <div class="w-4 h-4 rounded-full border-2 border-gray-200 border-t-gray-500 animate-spin"></div>
          <span class="text-sm">{{ `加载中…` }}</span>
        </div>
      </div>
    </div>

    <div class="h-7 flex items-center justify-between px-4 border-t border-gray-200 bg-gray-50 text-[10px] font-mono text-gray-600 select-none">
      <div class="flex items-center gap-4">
        <span>{{ `行 ${line}，列 ${col}` }}</span>
        <span>{{ `行数 ${lineCount}` }}</span>
        <span>{{ `字符 ${charCount}` }}</span>
      </div>
      <div class="flex items-center gap-4">
        <span>UTF-8</span>
        <span class="uppercase">{{ language }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { FileText } from 'lucide-vue-next';
import { useOs } from '@/os';
import { reopenCurrentAppWindow } from '@/os';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, highlightSpecialChars } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { oneDark } from '@codemirror/theme-one-dark';
import { tags as t } from '@lezer/highlight';
import { HighlightStyle, defaultHighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { markdown } from '@codemirror/lang-markdown';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';

const os = useOs();
const api = os.api;
const { toast } = os.ui;

const props = defineProps({
  files: { type: Array, default: () => [] }
});

const loading = ref(true);
const isSaving = ref(false);
const isDirty = ref(false);

const content = ref('');
const originalContent = ref('');
const editorHostRef = ref(null);
const editorViewRef = ref(null);
const fileSize = ref(0);

const cursorPosition = ref({ line: 1, col: 1 });
const stats = ref({ lines: 1, chars: 0 });

const target = computed(() => (Array.isArray(props.files) ? props.files[0] : null));
const displayPath = computed(() => target.value?.path || '');
const displayName = computed(() => String(displayPath.value || '').split('/').filter(Boolean).pop() || '');
const hasFile = computed(() => !!displayPath.value);
const line = computed(() => Number(cursorPosition.value?.line) || 1);
const col = computed(() => Number(cursorPosition.value?.col) || 1);
const lineCount = computed(() => Number(stats.value?.lines) || 1);
const charCount = computed(() => Number(stats.value?.chars) || 0);

const closeSelf = () => {
  os.window.close();
};

const language = computed(() => {
  const ext = displayName.value.includes('.') ? displayName.value.split('.').pop().toLowerCase() : '';
  if (!ext) return 'txt';
  if (ext === 'md' || ext === 'markdown') return 'md';
  return ext;
});

const formatBytes = (bytes) => {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / Math.pow(1024, i);
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
};

const wrap = ref(false);
const isDark = ref(false);

const applyThemePreference = () => {
  try {
    isDark.value = !!window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
  } catch {
    isDark.value = false;
  }
};

const detectLanguageExtension = (ext) => {
  const e = String(ext || '').toLowerCase();
  if (e === 'js' || e === 'jsx') return javascript({ jsx: true });
  if (e === 'ts' || e === 'tsx') return javascript({ typescript: true, jsx: e === 'tsx' });
  if (e === 'json' || e === 'jsonc') return json();
  if (e === 'py') return python();
  if (e === 'html' || e === 'htm' || e === 'vue') return html();
  if (e === 'css' || e === 'scss' || e === 'less') return css();
  if (e === 'md' || e === 'markdown') return markdown();
  if (e === 'sql') return sql();
  if (e === 'xml') return xml();
  return null;
};

const lightSyntax = HighlightStyle.define([
  { tag: t.keyword, color: '#7c3aed', fontWeight: 600 },
  { tag: [t.string, t.special(t.string)], color: '#0f766e' },
  { tag: [t.number, t.bool, t.null], color: '#b45309' },
  { tag: [t.comment], color: '#64748b', fontStyle: 'italic' },
  { tag: [t.variableName, t.propertyName], color: '#0f172a' },
  { tag: [t.typeName, t.className], color: '#1d4ed8' },
  { tag: [t.function(t.variableName)], color: '#0f766e', fontWeight: 600 },
]);

const lightTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
    color: '#0f172a',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: '14px',
    lineHeight: '24px',
  },
  '.cm-scroller': { overflow: 'auto' },
  '.cm-content': { padding: '12px 16px' },
  '.cm-gutters': { backgroundColor: 'transparent', border: 'none' },
  '.cm-lineNumbers': { color: '#94a3b8' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(15, 23, 42, 0.04)' },
  '.cm-activeLine': { backgroundColor: 'rgba(15, 23, 42, 0.03)' },
  '.cm-selectionBackground': { backgroundColor: 'rgba(37, 99, 235, 0.18)' },
  '.cm-cursor': { borderLeftColor: '#0f172a' },
  '.cm-selectionMatch': { backgroundColor: 'rgba(245, 158, 11, 0.20)' },
});

const buildEditorExtensions = () => {
  const ext = detectLanguageExtension(language.value);
  const theme = isDark.value ? oneDark : [lightTheme, syntaxHighlighting(lightSyntax)];
  const wrapExt = wrap.value ? EditorView.lineWrapping : [];
  return [
    highlightSpecialChars(),
    lineNumbers(),
    highlightActiveLineGutter(),
    history(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    keymap.of([
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      indentWithTab,
      {
      key: 'Mod-s',
      run: () => {
        save();
        return true;
      }
      }
    ]),
    highlightSelectionMatches(),
    highlightActiveLine(),
    wrapExt,
    ext ? ext : [],
    theme,
    EditorView.updateListener.of((update) => {
      if (!update.docChanged && !update.selectionSet) return;
      const view = update.view;
      const doc = view.state.doc;

      const pos = view.state.selection.main.head;
      const lineInfo = doc.lineAt(pos);
      cursorPosition.value = { line: lineInfo.number, col: (pos - lineInfo.from) + 1 };
      stats.value = { lines: doc.lines || 1, chars: doc.length || 0 };

      if (update.docChanged) {
        if (doc.length !== originalContent.value.length) {
          isDirty.value = true;
        } else {
          isDirty.value = doc.toString() !== originalContent.value;
        }
      }
    })
  ];
};

const destroyEditor = () => {
  if (editorViewRef.value) {
    editorViewRef.value.destroy();
    editorViewRef.value = null;
  }
};

const createEditor = (initialDoc) => {
  const host = editorHostRef.value;
  if (!host) return;
  destroyEditor();
  editorViewRef.value = new EditorView({
    state: EditorState.create({
      doc: String(initialDoc ?? ''),
      extensions: buildEditorExtensions(),
    }),
    parent: host,
  });
  const doc = editorViewRef.value.state.doc;
  stats.value = { lines: doc.lines || 1, chars: doc.length || 0 };
  cursorPosition.value = { line: 1, col: 1 };
};

const setEditorDoc = (next) => {
  const view = editorViewRef.value;
  if (!view) return;
  const text = String(next ?? '');
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text }
  });
};

const ensureEditor = () => {
  if (loading.value) return;
  if (!hasFile.value) return;
  if (!editorViewRef.value) {
    createEditor(content.value);
    return;
  }
};

const toggleTheme = () => {
  isDark.value = !isDark.value;
  if (!editorViewRef.value) return;
  const pos = editorViewRef.value.state.selection.main.head;
  const text = editorViewRef.value.state.doc.toString();
  createEditor(text);
  editorViewRef.value.dispatch({ selection: { anchor: pos } });
};

const toggleWrap = () => {
  wrap.value = !wrap.value;
  if (!editorViewRef.value) return;
  const pos = editorViewRef.value.state.selection.main.head;
  const text = editorViewRef.value.state.doc.toString();
  createEditor(text);
  editorViewRef.value.dispatch({ selection: { anchor: pos } });
};

const load = async () => {
  if (!displayPath.value) return;
  loading.value = true;
  try {
    fileSize.value = 0;
    try {
      const stat = await api.getFileStat(displayPath.value);
      fileSize.value = Number(stat?.size) || 0;
    } catch {
      void 0;
    }

    const data = await api.getFileContent(displayPath.value);
    content.value = typeof data === 'object' ? JSON.stringify(data, null, 2) : (data ?? '');
    originalContent.value = content.value;
    isDirty.value = false;
  } catch (e) {
    toast.value?.error?.(e?.message || `加载失败`);
  } finally {
    loading.value = false;
  }
};

const pickFile = () => {
  os.stores.windows.openFileSelector((selectedFile) => {
    if (!selectedFile) return;

    reopenCurrentAppWindow(os, {
      title: selectedFile.name || selectedFile.path,
      componentProps: { files: [selectedFile] }
    });
    closeSelf();
  });
};

const save = async () => {
  if (loading.value || isSaving.value || !isDirty.value) return;
  isSaving.value = true;
  try {
    const text = editorViewRef.value ? editorViewRef.value.state.doc.toString() : content.value;
    await api.saveFileContent(displayPath.value, text);
    originalContent.value = text;
    isDirty.value = false;
    toast.value?.success?.('apps.text-editor.common.saved');
  } catch (e) {
    toast.value?.error?.(e?.message || `保存失败`);
  } finally {
    isSaving.value = false;
  }
};

onMounted(() => {
  if (!hasFile.value) loading.value = false;
  applyThemePreference();
});

watch(displayPath, (p) => {
  if (!p) {
    loading.value = false;
    content.value = '';
    originalContent.value = '';
    isDirty.value = false;
    fileSize.value = 0;
    destroyEditor();
    return;
  }
  load();
}, { immediate: true });

watch(loading, async (v) => {
  if (v) return;
  await nextTick();
  ensureEditor();
  setEditorDoc(content.value);
});

watch(language, () => {
  if (!editorViewRef.value) return;
  const pos = editorViewRef.value.state.selection.main.head;
  const text = editorViewRef.value.state.doc.toString();
  createEditor(text);
  editorViewRef.value.dispatch({ selection: { anchor: pos } });
});

onUnmounted(() => {
  destroyEditor();
});
</script>
