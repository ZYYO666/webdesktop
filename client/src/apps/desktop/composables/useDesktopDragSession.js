import { computed, ref } from 'vue';

const clampInt = (n, min, max) => Math.min(max, Math.max(min, Math.floor(n)));

export const useDesktopDragSession = ({ desktopLayout, getLayoutKey } = {}) => {
  const dragSession = ref(null);

  const ensureDragSession = (next) => {
    if (dragSession.value) return;
    dragSession.value = {
      type: next?.type || '',
      instanceId: next?.instanceId || null,
      movingPaths: Array.isArray(next?.movingPaths) ? next.movingPaths : null,
      hideSource: false,
      desktopLayoutSnapshot: { ...(desktopLayout?.value || {}) },
    };
  };

  const clearDragSession = ({ restore } = { restore: true }) => {
    const s = dragSession.value;
    dragSession.value = null;
    if (s?.dragImageEl) {
      try {
        s.dragImageEl.remove();
      } catch {
        void 0;
      }
    }
    if (restore && s) {
      if (desktopLayout) desktopLayout.value = { ...(s.desktopLayoutSnapshot || {}) };
    }
  };

  const setCustomDragImageFromEl = (e, el) => {
    if (!e?.dataTransfer || !el) return;
    const rect = el.getBoundingClientRect?.();
    if (!rect) return;
    const img = el.cloneNode(true);
    img.style.position = 'fixed';
    img.style.left = '-9999px';
    img.style.top = '-9999px';
    img.style.transform = 'none';
    img.style.opacity = '0.95';
    img.style.pointerEvents = 'none';
    img.style.margin = '0';
    img.style.zIndex = '2147483647';
    document.body.appendChild(img);
    const offX = clampInt((e.clientX ?? rect.left) - rect.left, 0, rect.width);
    const offY = clampInt((e.clientY ?? rect.top) - rect.top, 0, rect.height);
    try {
      e.dataTransfer.setDragImage(img, offX, offY);
    } catch {
      void 0;
    }
    if (dragSession.value) dragSession.value.dragImageEl = img;
  };

  const draggingIconPathsSet = computed(() => {
    const s = dragSession.value;
    if (!s || s.type !== 'file-list' || !Array.isArray(s.movingPaths)) return new Set();
    return new Set(s.movingPaths.map((p) => String(p || '')).filter(Boolean));
  });

  const shouldHideDesktopItem = (item) => {
    const key = getLayoutKey?.(item);
    if (!key) return false;
    if (!dragSession.value?.hideSource) return false;
    return draggingIconPathsSet.value.has(key);
  };

  return {
    dragSession,
    ensureDragSession,
    clearDragSession,
    setCustomDragImageFromEl,
    shouldHideDesktopItem,
  };
};

