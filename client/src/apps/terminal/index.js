import { markRaw, defineAsyncComponent } from 'vue';
import { defineApp } from '@/os';
import iconUrl from './icon.png';

export default defineApp({
  id: 'terminal',
  name: '终端',
  iconImage: iconUrl,
  component: markRaw(defineAsyncComponent(() => import('./index.vue'))),
  supports: {
    types: ['directory'],
    priority: 10,
    directoryContext: true
  },
  role: 'admin',
  isPin: true
});
