import { markRaw, defineAsyncComponent } from 'vue';
import { defineApp } from '@/os';
import iconUrl from './icon.png';

export default defineApp({
  id: 'task-manager',
  name: '任务管理器',
  iconImage: iconUrl,
  component: markRaw(defineAsyncComponent(() => import('./index.vue'))),
  role: 'admin',
  isPin: true,
  immersive: true
});
