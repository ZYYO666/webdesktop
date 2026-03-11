import { markRaw, defineAsyncComponent } from 'vue';
import { defineApp } from '@/os';
import iconUrl from './icon.png';

export default defineApp({
  id: 'settings',
  name: '设置',
  iconImage: iconUrl,
  component: markRaw(defineAsyncComponent(() => import('./index.vue'))),
  role: 'guest',
  isPin: true,
  immersive: true,
});
