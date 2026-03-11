import { ref, watch } from 'vue';

export const useDesktopUiVisibility = ({ storageKey = 'desktop-ui-visibility-v1' } = {}) => {
  const showDesktopIcons = ref(true);
  const showDock = ref(true);

  const loadDesktopUiVisibility = () => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.icons === 'boolean') showDesktopIcons.value = parsed.icons;
      if (typeof parsed?.dock === 'boolean') showDock.value = parsed.dock;
    } catch {
      void 0;
    }
  };

  const saveDesktopUiVisibility = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        icons: !!showDesktopIcons.value,
        dock: !!showDock.value
      }));
    } catch {
      void 0;
    }
  };

  watch([showDesktopIcons, showDock], () => saveDesktopUiVisibility());

  return { showDesktopIcons, showDock, loadDesktopUiVisibility };
};

