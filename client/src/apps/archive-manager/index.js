import { markRaw, defineAsyncComponent } from 'vue';
import { defineApp } from '@/os';
import { Archive } from 'lucide-vue-next';
import iconUrl from './icon.png';

const ARCHIVE_EXTS = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz', 'tbz', 'tbz2', 'zst', 'lz', 'lz4', 'cab']);

export default defineApp({
  id: 'archive',
  name: '压缩管理',
  iconImage: iconUrl,
  component: markRaw(defineAsyncComponent(() => import('./index.vue'))),
  role: 'guest',
  width:550,
  height:400,
  supports: {
    priority: 40,
    extensionGroups: [
      { id: 'archive', icon: Archive, fgClass: 'text-yellow-800', bgClass: 'bg-yellow-50', extensions: ARCHIVE_EXTS }
    ]
  }
});
