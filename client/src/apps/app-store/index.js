import { markRaw, defineAsyncComponent } from 'vue';
import { defineApp } from '@/os';

export default defineApp({
  id: 'app-store',
  name: 'Docker 管理器',
  component: markRaw(defineAsyncComponent(() => import('./index.vue'))),
  resizable: true,
  minimizable: true,
  maximizable: true,
  isPin: true,
  immersive: true,
  role: 'admin',
  supports: {
    types: ['directory'],
    priority: 5,
    directoryContext: true
  }
});
