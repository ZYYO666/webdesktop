import { markRaw, defineAsyncComponent } from 'vue';
import { defineApp } from '@/os';
import iconUrl from './icon.png';

export default defineApp({
  id: 'file-browser',
  name: '文件浏览器',
  iconImage: iconUrl,
  component: markRaw(defineAsyncComponent(() => import('./index.vue'))),
  resolveFileIcon: () => {
    return { kind: 'img', src: iconUrl };
  },
  supports: {
    types: ['directory'],
    priority: 100,
    directoryContext: true
  },
  role: 'guest',
  isPin: true,
  immersive: true
});
