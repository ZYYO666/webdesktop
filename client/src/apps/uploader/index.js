import { markRaw, defineAsyncComponent } from 'vue';
import { defineApp } from '@/os';

export default defineApp({
  id: 'uploader',
  name: '上传',
  component: markRaw(defineAsyncComponent(() => import('./index.vue'))),
  width: 720,
  height: 520,
  maximizable: false,
});
