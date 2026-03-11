import { markRaw, defineAsyncComponent } from 'vue';
import { defineApp, getFileExtension } from '@/os';
import { FileAudio, FileImage, FileVideo } from 'lucide-vue-next';
import iconUrl from './icon.png';

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tif', 'tiff', 'ico', 'avif', 'heic', 'heif']);
const VIDEO_EXTS = new Set(['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v', '3gp', 'mts', 'm2ts', 'ts', 'vob', 'ogv']);
const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'aiff', 'alac', 'opus', 'amr', 'mid', 'midi']);

export default defineApp({
  id: 'video-player',
  name: '媒体预览',
  iconImage: iconUrl,
  component: markRaw(defineAsyncComponent(() => import('./index.vue'))),
  role: 'guest',
  resolveFileIcon: ({ file, api }) => {
    const path = String(file?.path || '');
    if (!path) return null;
    const ext = getFileExtension(file);
    if (!ext) return null;
    if (!IMAGE_EXTS.has(ext) && !VIDEO_EXTS.has(ext)) return null;
    return { kind: 'thumb', src: api.getThumbUrl(path), isVideo: VIDEO_EXTS.has(ext) };
  },
  supports: {
    priority: 10,
    extensionGroups: [
      { id: 'image', icon: FileImage, fgClass: 'text-pink-700', bgClass: 'bg-pink-50', extensions: IMAGE_EXTS },
      { id: 'video', icon: FileVideo, fgClass: 'text-rose-700', bgClass: 'bg-rose-50', extensions: VIDEO_EXTS, isVideo: true },
      { id: 'audio', icon: FileAudio, fgClass: 'text-violet-700', bgClass: 'bg-violet-50', extensions: AUDIO_EXTS }
    ]
  }
});
