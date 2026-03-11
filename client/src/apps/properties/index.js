import { markRaw, defineAsyncComponent } from 'vue';
import { defineApp } from '@/os';

export default defineApp({
  id: 'properties',
  name: '属性',
  component: markRaw(defineAsyncComponent(() => import('./index.vue'))),
  width: 360,
  height: 420,
  resizable: false,
  minimizable: false,
  maximizable: false,
});
