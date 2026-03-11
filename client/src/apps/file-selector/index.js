import { markRaw, defineAsyncComponent } from 'vue';
import { defineApp } from '@/os';
import iconUrl from './icon.png';

export default defineApp({
  id: 'file-selector',
  name: '文件选择器',
  iconImage: iconUrl,
  component: markRaw(defineAsyncComponent(() => import('./index.vue'))),
  width: 690,
  height: 500,
  minimizable: false,
  maximizable: false,
  role: 'guest'
});
