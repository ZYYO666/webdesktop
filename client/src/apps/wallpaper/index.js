import { markRaw, defineAsyncComponent } from 'vue';
import { defineApp } from '@/os';
import { Image } from 'lucide-vue-next';

export default defineApp({
  id: 'wallpaper',
  name: '壁纸商店',
  icon: Image,
  component: markRaw(defineAsyncComponent(() => import('./index.vue'))),
  resizable: true,
  minimizable: true,
  maximizable: true,
  immersive: true,
});
