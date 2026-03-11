import { markRaw, defineAsyncComponent } from 'vue';
import { defineApp } from '@/os';
import { Database, FileCode2, FileCog, FileJson, FileLock, FileText } from 'lucide-vue-next';
import iconUrl from './icon.png';

const TEXT_EXTS = new Set(['txt', 'log']);
const SQL_EXTS = new Set(['sql']);
const CODE_EXTS = new Set(['js', 'jsx', 'ts', 'tsx', 'css', 'vue', 'py', 'c', 'cpp', 'h', 'java', 'sh', 'bat', 'rb', 'php', 'go', 'rs']);
const DATA_EXTS = new Set(['json', 'xml', 'yaml', 'yml']);
const CONFIG_EXTS = new Set(['ini', 'conf', 'toml', 'env', 'gitignore', 'dockerfile', 'makefile', '属性']);
const LOCK_EXTS = new Set(['lock']);

export default defineApp({
  id: 'text',
  name: '代码编辑器',
  iconImage: iconUrl,
  component: markRaw(defineAsyncComponent(() => import('./index.vue'))),
  supports: {
    priority: 1,
    extensionGroups: [
      { id: 'sql', icon: Database, fgClass: 'text-cyan-700', bgClass: 'bg-cyan-50', extensions: SQL_EXTS },
      { id: 'text', icon: FileText, fgClass: 'text-slate-700', bgClass: 'bg-slate-100', extensions: TEXT_EXTS },
      { id: 'code', icon: FileCode2, fgClass: 'text-emerald-700', bgClass: 'bg-emerald-50', extensions: CODE_EXTS },
      { id: 'data', icon: FileJson, fgClass: 'text-amber-700', bgClass: 'bg-amber-50', extensions: DATA_EXTS },
      { id: 'config', icon: FileCog, fgClass: 'text-slate-700', bgClass: 'bg-slate-100', extensions: CONFIG_EXTS },
      { id: 'lock', icon: FileLock, fgClass: 'text-slate-700', bgClass: 'bg-slate-100', extensions: LOCK_EXTS }
    ]
  }
});
