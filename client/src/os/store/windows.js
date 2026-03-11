import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAuthStore } from './auth';
import { APPS } from '../registry/index';
import { uiModule } from '../ui/index';
import { 
  getAppTitle, getParentDirPath, getPathBaseName, isDirectoryFile, normalizeFileRef, normalizeFiles, resolveBestAppForFile 
} from '../utils/index';

export const useWindowStore = defineStore('windows', () => {
  const activeWindows = ref([]);
  const activeWindowId = ref(null);
  const windowZIndex = ref(100);

  // Computed
  const getActiveWindow = computed(() => 
    activeWindows.value.find(w => w.id === activeWindowId.value)
  );

  // Actions
  const closeWindow = (id) => {
    const win = activeWindows.value.find((w) => w.id === id);
    if (win) {
      if (win._resolve) win._resolve(null);
      activeWindows.value = activeWindows.value.filter((w) => w.id !== id);
      
      if (activeWindowId.value === id) {
        const next = activeWindows.value.reduce((top, cur) => {
          if (!top) return cur;
          return (cur.zIndex || 0) > (top.zIndex || 0) ? cur : top;
        }, null);
        activeWindowId.value = next ? next.id : null;
      }
    }
  };

  const bringToFront = (id) => {
    const win = activeWindows.value.find((w) => w.id === id);
    if (win) activeWindowId.value = id;
    if (win && win.zIndex !== windowZIndex.value) {
      windowZIndex.value += 1;
      win.zIndex = windowZIndex.value;
    }
  };

  const minimizeWindow = (id) => {
    const win = activeWindows.value.find((w) => w.id === id);
    if (win) win.isMinimized = true;
  };

  const restoreWindow = (id) => {
    const win = activeWindows.value.find((w) => w.id === id);
    if (win) {
      win.isMinimized = false;
      bringToFront(id);
    }
  };

  const toggleWindow = (id) => {
    const win = activeWindows.value.find((w) => w.id === id);
    if (win) {
      if (win.isMinimized) {
        restoreWindow(id);
      } else {
        const maxZ = Math.max(...activeWindows.value.map((w) => w.zIndex || 0));
        if (win.zIndex === maxZ && activeWindowId.value === id) minimizeWindow(id);
        else bringToFront(id);
      }
    }
  };

  const updateWindow = (id, updater) => {
    const win = activeWindows.value.find((w) => w.id === id);
    if (!win) return false;
    if (typeof updater === 'function') updater(win);
    return true;
  };

  const addWindow = (windowConfig) => {
    activeWindows.value.push(windowConfig);
    activeWindowId.value = windowConfig.id;
    windowZIndex.value += 1; // Increment global zIndex
    // Update the newly added window's zIndex to match global
    const win = activeWindows.value.find(w => w.id === windowConfig.id);
    if (win) win.zIndex = windowZIndex.value;
  };

  // --- Logic Moved from Runtime/Apps ---
  
  const openWindow = (app) => {
    return new Promise((resolve) => {
      const authStore = useAuthStore();
      
      const componentProps = { ...(app.componentProps || {}) };
      const normalizedApp = { ...app };

      componentProps.files = normalizeFiles(componentProps.files);
      normalizedApp.componentProps = componentProps;

      const requiredRole = normalizedApp.role || 'user';
      if (!authStore.hasRole(requiredRole)) {
        const roleLabel = requiredRole === 'admin' ? 'Administrator' : 'User';
        uiModule.toast.error(`Permission denied. Required role: ${roleLabel || requiredRole}`);
        resolve(false);
        return;
      }

      const appId = normalizedApp.id || normalizedApp.appId;
      if (!appId) {
        uiModule.toast.error('Invalid app: missing id');
        resolve(false);
        return;
      }

      const id = normalizedApp.windowId || (Date.now() + Math.random().toString(36).slice(2, 11));
      
      addWindow({
        ...normalizedApp,
        id,
        appId,
        title: normalizedApp.title || getAppTitle(normalizedApp) || normalizedApp.name,
        component: undefined,
        iconImage: normalizedApp.iconImage,
        // Runtime is now injected via DI in WindowContainer
        defaultMaximized:
          typeof normalizedApp.defaultMaximized === 'boolean'
            ? normalizedApp.defaultMaximized
            : false,
        _resolve: resolve
      });
    });
  };

  const openFileSelector = (onSelect, options = {}) => {
    const selectorId = Date.now();
    const app = APPS.FILE_SELECTOR;
    if (!app) {
      uiModule.toast.error('File Selector app not found in APPS');
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      openWindow({
        ...app,
        title: options.title,
        windowId: selectorId,
        componentProps: {
          onSelect: (file) => {
            if (typeof onSelect === 'function') onSelect(file);
            resolve(file || null);
            closeWindow(selectorId);
          },
          onCancel: () => {
            resolve(null);
            closeWindow(selectorId);
          },
          ...options
        }
      });
    });
  };

  const openFile = (file, appId = null) => {
    // 1. Resolve appId if not provided
    if (!appId) {
      const best = resolveBestAppForFile(file, APPS);
      appId = best ? best.id : APPS.OPEN_WITH.id;
    }

    // 2. Resolve app
    const app = Object.values(APPS).find((a) => a.id === appId);
    if (!app) return false;

    // 4. Normalize file
    const ref = normalizeFileRef(file);
    if (!ref) return false;
    const baseName = getPathBaseName(ref.path) || ref.path || getAppTitle(app) || app.name;

    // 5. Directory-context app launch
    const supportsTypes = Array.isArray(app?.supports?.types) ? app.supports.types : [];
    const supportsDirectory = supportsTypes.includes('directory');
    const directoryContext = app?.supports?.directoryContext === true;

    const isDirRef = isDirectoryFile(ref);
    const shouldOpenDirectoryContext = isDirRef ? (supportsDirectory || directoryContext) : directoryContext;

    if (shouldOpenDirectoryContext) {
      const dirPath = isDirectoryFile(ref) ? ref.path : getParentDirPath(ref.path);
      openWindow({
        ...app,
        componentProps: {
          files: [{ type: 'dir', path: dirPath }]
        }
      });
      return true;
    }

    // 6. Generic file launch
    openWindow({
      ...app,
      width: app.width,
      height: app.height,
      resizable: app.resizable,
      minimizable: app.minimizable,
      maximizable: app.maximizable,
      title: baseName,
      iconImage: app.iconImage,
      componentProps: {
        files: [ref]
      }
    });
    return true;
  };

  return {
    activeWindows,
    activeWindowId,
    windowZIndex,
    getActiveWindow,
    closeWindow,
    bringToFront,
    minimizeWindow,
    restoreWindow,
    toggleWindow,
    updateWindow,
    addWindow,
    // New unified actions
    openWindow,
    openFileSelector,
    openFile
  };
});
