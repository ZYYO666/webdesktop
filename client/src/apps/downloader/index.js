import { markRaw, defineAsyncComponent } from 'vue';
import { defineApp } from '@/os';
import iconUrl from './icon.png';



export default defineApp({
  id: 'downloader',
  name: '下载器',
  iconImage: iconUrl,
  component: markRaw(defineAsyncComponent(() => import('./index.vue'))),
  width: 800,
  height: 600,
  maximizable: true,
  isPin: true,
  immersive: true
});
