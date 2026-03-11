import { defineStore } from 'pinia';
import { ref } from 'vue';
import { createApi } from '../api/index';
import { uiModule } from '../ui/index';

export const useSystemStore = defineStore('system', () => {
  const api = createApi();
  const MIN_WALLPAPER_INTERVAL_MS = 1000;

  // State
  const appTitle = ref('CloudGallery');
  const wallpaper = ref('');
  const currentWallpaperUrl = ref('');
  const currentWallpaperKind = ref('none');
  const fullscreenCoverDock = ref(false);
  const dockPosition = ref('bottom');
  const dockMode = ref('floating');
  const siteInfoLoaded = ref(false);

  // Slideshow state
  let slideshowTimer = null;
  const slideshowIndex = ref(0);
  let slideshowOrder = [];

  const shuffleInPlace = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  };

  const ensureFirstNotUrl = (images, order, avoidUrl) => {
    if (!avoidUrl || order.length < 2) return order;
    if (images[order[0]] !== avoidUrl) return order;
    const swapIndex = order.findIndex((idx) => images[idx] !== avoidUrl);
    if (swapIndex > 0) {
      const tmp = order[0];
      order[0] = order[swapIndex];
      order[swapIndex] = tmp;
    }
    return order;
  };

  const setCurrentWallpaper = (url, kind) => {
    currentWallpaperUrl.value = url || '';
    currentWallpaperKind.value = kind || 'none';
  };

  const processWallpaper = (rawWallpaper) => {
    if (slideshowTimer) {
      clearInterval(slideshowTimer);
      slideshowTimer = null;
    }

    if (!rawWallpaper) {
      setCurrentWallpaper('', 'none');
      return;
    }

    try {
      const config = JSON.parse(rawWallpaper);
      
      if (config?.enabled === false) {
        setCurrentWallpaper('', 'none');
        return;
      }

      if (!config || typeof config !== 'object') {
        setCurrentWallpaper('', 'none');
        return;
      }

      const mode = String(config?.mode || 'slideshow').toLowerCase();
      if (mode === 'video') {
        const url =
          config.videoUrl ||
          (Array.isArray(config.videos) && config.videos.length > 0 ? config.videos[0] : '') ||
          '';
        setCurrentWallpaper(url, url ? 'video' : 'none');
        return;
      }

      if (mode === 'slideshow') {
        const images = Array.isArray(config.images) ? config.images : [];
        const fixedUrl = String(config.fixedUrl || '');

        if (images.length <= 0) {
          setCurrentWallpaper('', 'none');
          return;
        }

        const rawInterval = config.slideshowInterval;
        const interval = Number(rawInterval);
        const intervalMs = Number.isFinite(interval) ? interval : 60000;
        if (intervalMs <= 0) {
          const url = fixedUrl || images[0] || '';
          setCurrentWallpaper(url, url ? 'image' : 'none');
          return;
        }
        const normalizedIntervalMs = Math.max(MIN_WALLPAPER_INTERVAL_MS, intervalMs);

        const buildOrder = (avoidUrl) => {
          const order = shuffleInPlace(Array.from({ length: images.length }, (_, i) => i));
          if (fixedUrl) {
            const fixedIndex = images.indexOf(fixedUrl);
            if (fixedIndex > -1) {
              const rest = order.filter((idx) => idx !== fixedIndex);
              return [fixedIndex, ...rest];
            }
          }
          return ensureFirstNotUrl(images, order, avoidUrl);
        };

        slideshowOrder = buildOrder(fixedUrl || currentWallpaperUrl.value);
        slideshowIndex.value = 0;
        setCurrentWallpaper(images[slideshowOrder[0]] || '', 'image');

        if (images.length >= 2) {
          slideshowTimer = setInterval(() => {
            const isLast = slideshowIndex.value >= slideshowOrder.length - 1;
            if (isLast) {
              const avoidUrl = images[slideshowOrder[slideshowOrder.length - 1]];
              slideshowOrder = buildOrder(avoidUrl);
              slideshowIndex.value = 0;
              setCurrentWallpaper(images[slideshowOrder[0]] || '', 'image');
              return;
            }

            slideshowIndex.value += 1;
            setCurrentWallpaper(images[slideshowOrder[slideshowIndex.value]] || '', 'image');
          }, normalizedIntervalMs);
        }
        return;
      }
      
      setCurrentWallpaper('', 'none');
    } catch (e) {
      setCurrentWallpaper('', 'none');
    }
  };

  // Actions
  const updateSiteInfo = (newInfo) => {
    if (newInfo.title) {
      appTitle.value = newInfo.title;
      document.title = newInfo.title;
    }
    if (newInfo.wallpaper !== undefined) {
      wallpaper.value = newInfo.wallpaper;
      processWallpaper(newInfo.wallpaper);
    }
    if (newInfo.fullscreenCoverDock !== undefined) {
      fullscreenCoverDock.value = !!newInfo.fullscreenCoverDock;
    }
    if (newInfo.dockPosition !== undefined) {
      const p = String(newInfo.dockPosition || '').toLowerCase();
      dockPosition.value = (p === 'top' || p === 'right' || p === 'left' || p === 'bottom') ? p : 'bottom';
    }
    if (newInfo.dockMode !== undefined) {
      const m = String(newInfo.dockMode || '').toLowerCase();
      dockMode.value = (m === 'edge' || m === 'floating') ? m : 'floating';
    }
  };

  const fetchSiteInfo = async () => {
    try {
      const info = await api.getSiteInfo();
      if (!info || typeof info !== 'object') return null;

      if (info.title) {
        updateSiteInfo({ title: info.title });
      }

      if (info.wallpaper) {
        updateSiteInfo({ wallpaper: info.wallpaper });
      }

      if (info.fullscreenCoverDock !== undefined) {
        updateSiteInfo({ fullscreenCoverDock: info.fullscreenCoverDock });
      }

      if (info.dockPosition !== undefined) {
        updateSiteInfo({ dockPosition: info.dockPosition });
      }

      if (info.dockMode !== undefined) {
        updateSiteInfo({ dockMode: info.dockMode });
      }

      siteInfoLoaded.value = true;
      return info;
    } catch (err) {
      uiModule.toast?.error?.('获取站点信息失败');
      return null;
    }
  };

  const requestSiteInfoRefresh = () => {
    return fetchSiteInfo();
  };

  return {
    appTitle,
    wallpaper,
    currentWallpaperUrl,
    currentWallpaperKind,
    fullscreenCoverDock,
    dockPosition,
    dockMode,
    siteInfoLoaded,
    updateSiteInfo,
    fetchSiteInfo,
    requestSiteInfoRefresh
  };
});
