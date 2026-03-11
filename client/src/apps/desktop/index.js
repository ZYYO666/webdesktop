import DesktopComponent from './index.vue';
import { defineApp } from '@/os';

export default defineApp({
  id: 'desktop',
  name: 'Desktop',
  title: 'Desktop',
  component: DesktopComponent,
  role: 'system',
});
