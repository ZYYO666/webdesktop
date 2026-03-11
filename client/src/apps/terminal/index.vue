<template>
  <div class="h-full w-full flex flex-col bg-white text-gray-900 relative" @pointerdown.capture="handleContainerPointerDown">
    <div
      class="h-12 shrink-0 flex items-center justify-between px-4 border-b border-gray-100 bg-white/80 backdrop-blur-xl absolute top-0 left-0 right-0 z-20"
      data-window-drag
    >
      <div class="flex items-center gap-2">
        <div class="text-[13px] font-semibold text-gray-900">{{ `终端` }}</div>
        <span v-if="running" class="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">运行中</span>
      </div>
      <div class="flex items-center gap-2 min-w-0">
        <div class="text-[12px] text-gray-500 truncate max-w-[40vw] font-mono">{{ cwd }}</div>
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="h-7 px-2 rounded-md text-[11px] text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent"
            @click="clearOutput"
          >清空</button>
          <button
            type="button"
            class="h-7 px-2 rounded-md text-[11px] text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent"
            @click="copyOutput"
          >复制</button>
          <button
            type="button"
            class="h-7 px-2 rounded-md text-[11px] border"
            :class="settings.wrap ? 'border-blue-200 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-500 hover:text-gray-800'"
            @click="toggleWrap"
          >换行</button>
          <button
            type="button"
            class="h-7 px-2 rounded-md text-[11px] border"
            :class="settings.autoScroll ? 'border-blue-200 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-500 hover:text-gray-800'"
            @click="toggleAutoScroll"
          >自动滚动</button>
          <button
            type="button"
            class="h-7 w-7 rounded-md text-[12px] text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent"
            @click="adjustFontSize(-1)"
          >-</button>
          <button
            type="button"
            class="h-7 w-7 rounded-md text-[12px] text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent"
            @click="adjustFontSize(1)"
          >+</button>
        </div>
      </div>
    </div>

    <div
      ref="scrollRef"
      class="flex-1 min-h-0 overflow-auto px-4 py-4 font-mono bg-white pt-16"
      :style="{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }"
      @pointerdown="handleContainerPointerDown"
    >
      <div v-for="(line, idx) in lines" :key="idx" :class="settings.wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'">
        <span :class="line.kind === 'error' ? 'text-red-600' : line.kind === 'hint' ? 'text-gray-500' : 'text-gray-900'">
          {{ line.text }}
        </span>
      </div>
      <div v-if="running" class="mt-2 text-gray-400">{{ `正在运行...` }}</div>
    </div>

    <div class="shrink-0 px-4 py-3 border-t border-gray-200 bg-white">
      <div class="flex items-start gap-3 rounded-xl px-3 py-2 border transition-colors" :class="isInputFocused ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200'">
        <span class="select-none text-gray-700 text-[12px] leading-5 pt-[2px]">{{ prompt }}</span>
        <input
          ref="inputRef"
          v-model="input"
          class="flex-1 bg-transparent outline-none border-0 p-0 m-0 text-gray-900 caret-blue-600 placeholder:text-gray-400"
          :placeholder="`输入命令...`"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          @focus="isInputFocused = true"
          @blur="isInputFocused = false"
          @keydown="handleKeydown"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useOs } from '@/os';

const os = useOs();
const api = os.api;

defineProps({
  files: {
    type: Array,
    default: () => []
  }
});

const terminalExec = (...args) => api.terminalExec(...args);

const lines = ref([]);
const input = ref('');
const history = ref([]);
const historyIndex = ref(-1);
const running = ref(false);
const cwd = ref('/');
const isInputFocused = ref(false);
const sessionId = ref('');
const settings = ref({ fontSize: 12.5, lineHeight: 1.6, wrap: true, autoScroll: true });

const inputRef = ref(null);
const scrollRef = ref(null);

const username = computed(() => os.stores.auth.user?.username || 'guest');

const prompt = computed(() => `${username.value}@server:${cwd.value}$`);
const STORAGE_KEYS = {
  history: 'terminal_history',
  settings: 'terminal_settings'
};

const createSessionId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `sess_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const focusInput = () => {
  inputRef.value?.focus();
};

const handleContainerPointerDown = (e) => {
  if (e?.target === inputRef.value) return;
  requestAnimationFrame(() => {
    focusInput();
  });
};

const scrollToBottom = async () => {
  if (!settings.value.autoScroll) return;
  await nextTick();
  const el = scrollRef.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
};

const pushLine = async (text, kind = 'output') => {
  lines.value.push({ text: String(text ?? ''), kind });
  await scrollToBottom();
};

const formatAxiosError = (err) => {
  const status = err?.response?.status;
  const msg = err?.message || `未知错误`;
  if (status) return `${status}: ${msg}`;
  return msg;
};

const runOsCommand = async (raw) => {
  const data = await terminalExec(raw, sessionId.value, 15_000);
  const stdout = data?.stdout ?? '';
  const stderr = data?.stderr ?? '';

  if (stdout) await pushLine(stdout, 'output');
  if (stderr) await pushLine(stderr, 'error');
  if (data?.timedOut) await pushLine(`命令执行超时`, 'error');
  if (data?.truncated) await pushLine(`输出被截断`, 'error');
  if (typeof data?.exitCode === 'number' && data.exitCode !== 0 && !stderr) {
    await pushLine(`命令执行失败 (非零退出码)`, 'error');
  }
  if (typeof data?.cwd === 'string' && data.cwd) {
    cwd.value = data.cwd;
  }
};

const execute = async (raw) => {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return;

  if (trimmed === 'clear' || trimmed === 'cls') {
    lines.value = [];
    await scrollToBottom();
    return;
  }

  return runOsCommand(trimmed);
};

const runInput = async () => {
  if (running.value) return;
  const raw = input.value;
  input.value = '';
  historyIndex.value = -1;
  if (!String(raw || '').trim()) {
    await pushLine(`${prompt.value}`, 'output');
    return;
  }

  history.value.unshift(raw);
  history.value = history.value.slice(0, 200);
  persistHistory();
  await pushLine(`${prompt.value} ${raw}`, 'output');

  running.value = true;
  try {
    await execute(raw);
  } catch (err) {
    await pushLine(formatAxiosError(err), 'error');
  } finally {
    running.value = false;
    await scrollToBottom();
    focusInput();
  }
};

const handleKeydown = async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    await runInput();
    return;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    const nextIdx = historyIndex.value + 1;
    if (nextIdx >= history.value.length) return;
    historyIndex.value = nextIdx;
    input.value = history.value[historyIndex.value] || '';
    await nextTick();
    const el = inputRef.value;
    if (el) el.setSelectionRange(input.value.length, input.value.length);
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const nextIdx = historyIndex.value - 1;
    historyIndex.value = nextIdx;
    if (nextIdx < 0) {
      input.value = '';
      historyIndex.value = -1;
    } else {
      input.value = history.value[historyIndex.value] || '';
    }
    await nextTick();
    const el = inputRef.value;
    if (el) el.setSelectionRange(input.value.length, input.value.length);
    return;
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) {
    e.preventDefault();
    lines.value = [];
    await scrollToBottom();
    return;
  }
};

const clearOutput = async () => {
  lines.value = [];
  await scrollToBottom();
};

const copyOutput = async () => {
  const content = lines.value.map((line) => line.text).join('\n');
  if (!content) {
    os.ui.toast.info('暂无可复制内容');
    return;
  }
  try {
    await navigator.clipboard.writeText(content);
    os.ui.toast.success('已复制输出');
  } catch (_err) {
    os.ui.toast.error('复制失败');
  }
};

const toggleWrap = () => {
  settings.value.wrap = !settings.value.wrap;
  persistSettings();
};

const toggleAutoScroll = () => {
  settings.value.autoScroll = !settings.value.autoScroll;
  if (settings.value.autoScroll) scrollToBottom();
  persistSettings();
};

const adjustFontSize = (delta) => {
  const next = Math.min(18, Math.max(11, Number(settings.value.fontSize || 12.5) + delta));
  settings.value.fontSize = Number(next.toFixed(1));
  persistSettings();
};

const persistHistory = () => {
  os.appData.set(STORAGE_KEYS.history, history.value).catch(() => void 0);
};

const persistSettings = () => {
  os.appData.set(STORAGE_KEYS.settings, settings.value).catch(() => void 0);
};

const loadPersisted = async () => {
  try {
    const [savedHistory, savedSettings] = await Promise.all([
      os.appData.get(STORAGE_KEYS.history),
      os.appData.get(STORAGE_KEYS.settings),
    ]);
    if (Array.isArray(savedHistory)) history.value = savedHistory.slice(0, 200);
    if (savedSettings && typeof savedSettings === 'object') {
      settings.value = { ...settings.value, ...savedSettings };
    }
  } catch (_err) {
    return;
  }
};

watch(settings, () => {
  persistSettings();
}, { deep: true });

onMounted(async () => {
  sessionId.value = createSessionId();
  await loadPersisted();
  try {
    const data = await terminalExec('pwd', sessionId.value, 15_000);
    if (typeof data?.cwd === 'string' && data.cwd) cwd.value = data.cwd;
  } catch (err) {
    void 0;
  }
  focusInput();
});
</script>
