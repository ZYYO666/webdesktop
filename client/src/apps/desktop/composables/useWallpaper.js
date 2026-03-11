import { ref, watch } from 'vue';

export const useWallpaper = ({ currentWallpaperUrl, currentWallpaperKind } = {}) => {
  const wallpaperA = ref('');
  const wallpaperB = ref('');
  const wallpaperLayer = ref('a');
  const wallpaperVideoUrl = ref('');

  watch(
    [currentWallpaperUrl, currentWallpaperKind],
    ([url, kind]) => {
      const nextUrl = url || '';

      if (kind === 'video') {
        wallpaperVideoUrl.value = nextUrl;
        return;
      }

      wallpaperVideoUrl.value = '';

      if (!wallpaperA.value && !wallpaperB.value) {
        wallpaperA.value = nextUrl;
        wallpaperLayer.value = 'a';
        return;
      }

      const active = wallpaperLayer.value;
      const activeUrl = active === 'a' ? wallpaperA.value : wallpaperB.value;
      if (activeUrl === nextUrl) return;

      if (active === 'a') wallpaperB.value = nextUrl;
      else wallpaperA.value = nextUrl;

      requestAnimationFrame(() => {
        wallpaperLayer.value = active === 'a' ? 'b' : 'a';
      });
    },
    { immediate: true }
  );

  return { wallpaperA, wallpaperB, wallpaperLayer, wallpaperVideoUrl };
};

