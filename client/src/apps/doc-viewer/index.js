import { markRaw, defineAsyncComponent } from 'vue';
import { defineApp } from '@/os';
import { FileSpreadsheet, FileText, Presentation } from 'lucide-vue-next';
import iconUrl from './icon.png';

const PDF_EXTS = new Set(['pdf']);
const WORD_EXTS = new Set(['doc', 'docx']);
const SLIDE_EXTS = new Set(['ppt', 'pptx']);
const SHEET_EXTS = new Set(['xlsx', 'xls', 'csv']);
const MARKDOWN_EXTS = new Set(['md', 'markdown']);
const HTML_EXTS = new Set(['html', 'htm']);

export default defineApp({
  id: 'doc-viewer',
  name: '文档查看器',
  iconImage: iconUrl,
  component: markRaw(defineAsyncComponent(() => import('./index.vue'))),
  role: 'guest',
  supports: {
    priority: 40,
    extensionGroups: [
      { id: 'pdf', icon: FileText, fgClass: 'text-red-700', bgClass: 'bg-red-50', extensions: PDF_EXTS },
      { id: 'word', icon: FileText, fgClass: 'text-blue-700', bgClass: 'bg-blue-50', extensions: WORD_EXTS },
      { id: 'slide', icon: Presentation, fgClass: 'text-orange-700', bgClass: 'bg-orange-50', extensions: SLIDE_EXTS },
      { id: 'sheet', icon: FileSpreadsheet, fgClass: 'text-green-700', bgClass: 'bg-green-50', extensions: SHEET_EXTS },
      { id: 'markdown', icon: FileText, fgClass: 'text-indigo-700', bgClass: 'bg-indigo-50', extensions: MARKDOWN_EXTS },
      { id: 'html', icon: FileText, fgClass: 'text-orange-600', bgClass: 'bg-orange-50', extensions: HTML_EXTS }
    ]
  }
});
