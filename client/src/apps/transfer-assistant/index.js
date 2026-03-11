import { markRaw, defineAsyncComponent } from 'vue';
import { defineApp } from '@/os';

export default defineApp({
  id: 'transfer-assistant',
  name: '文本传输助手',
  component: markRaw(defineAsyncComponent(() => import('./index.vue'))),
  width: 720,
  height: 520,
  immersive: true,

  isPin: true,
});
