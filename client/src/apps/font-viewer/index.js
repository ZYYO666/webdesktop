import { markRaw, defineAsyncComponent } from 'vue';
import { defineApp } from '@/os';
import { Type } from 'lucide-vue-next';
import iconUrl from './icon.png';

const FONT_EXTS = new Set(['ttf', 'otf', 'woff', 'woff2', 'eot']);

export default defineApp({
  id: 'font-viewer',
  name: '字体查看器',
  iconImage: iconUrl,
  component: markRaw(defineAsyncComponent(() => import('./index.vue'))),
  role: 'guest',
  supports: {
    priority: 30,
    extensionGroups: [
      { id: 'font', icon: Type, fgClass: 'text-slate-700', bgClass: 'bg-slate-100', extensions: FONT_EXTS }
    ]
  }
});
