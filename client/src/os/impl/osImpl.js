import { inject, provide } from 'vue';
import { useWindowStore } from '../store/windows';
import { useSystemStore } from '../store/system';
import { useAuthStore } from '../store/auth';

import { uiModule } from '../ui/index';
import { createApi } from '../api/index';
import { APPS } from '../registry/index';
import { createContextMenu } from '../ui/contextMenu';
import { createAppDataApi } from '../services/appData';
import { createFilesApi, useFileStore } from '../services/filesOps';

export const OS_INJECTION_KEY = Symbol('os');

export const createOs = (config = {}) => {
  const { windowId } = config;

  const windowsStore = useWindowStore();
  const systemStore = useSystemStore();
  const authStore = useAuthStore();
  const fileStore = useFileStore();

  const hasWindow = !!windowId;
  const windowContext = {
    id: windowId || null,
    close: () => hasWindow && windowsStore.closeWindow(windowId),
    minimize: () => hasWindow && windowsStore.minimizeWindow(windowId),
    restore: () => hasWindow && windowsStore.restoreWindow(windowId),
    focus: () => hasWindow && windowsStore.bringToFront(windowId),
    setTitle: (title) => hasWindow && windowsStore.updateWindow(windowId, (w) => (w.title = title)),
    get isActive() {
      return hasWindow ? windowsStore.activeWindowId === windowId : false;
    },
    get data() {
      return hasWindow ? windowsStore.activeWindows.find((w) => w.id === windowId) : null;
    },
  };

  const actions = {};

  const stores = {
    windows: windowsStore,
    system: systemStore,
    auth: authStore,
  };
  const internalStores = { ...stores, files: fileStore };

  const contextMenu = createContextMenu();

  const api = createApi();
  const appData = createAppDataApi({ api, window: windowContext });
  const ui = { ...uiModule, contextMenu };
  const files = createFilesApi({ api, ui, stores: internalStores, apps: APPS });

  const os = {
    window: windowContext,
    api,
    ui,
    apps: APPS,
    actions,
    stores,
    appData,
    files,
  };

  return os;
};

export const provideOs = (os) => {
  provide(OS_INJECTION_KEY, os);
};

export const useOs = (config = {}) => {
  const os = inject(OS_INJECTION_KEY, null);
  return os || createOs(config);
};
