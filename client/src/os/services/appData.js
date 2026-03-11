export const createAppDataApi = ({ api, window }) => {
  const clean = (v) => String(v || '').trim();

  const resolveAppId = (explicitAppId = null) => {
    const fromParam = clean(explicitAppId);
    if (fromParam) return fromParam;

    const win = window?.data;
    const fromWinAppId = clean(win?.appId);
    if (fromWinAppId) return fromWinAppId;

    if (!win) {
      const fromWindowId = clean(window?.id);
      if (fromWindowId) return fromWindowId;
    }

    return '';
  };

  const requireAppId = (explicitAppId = null) => {
    const appId = resolveAppId(explicitAppId);
    if (!appId) throw new Error('appId is required');
    return appId;
  };

  return {
    list: async (appId = null) => api.getAppData(requireAppId(appId)),
    get: async (key, appId = null) => api.getAppDataKey(requireAppId(appId), key),
    set: async (key, value, appId = null) => api.setAppData(requireAppId(appId), key, value),
    delete: async (key, appId = null) => api.deleteAppData(requireAppId(appId), key),

    listByAppId: async (appId) => api.getAppData(requireAppId(appId)),
    getByAppId: async (appId, key) => api.getAppDataKey(requireAppId(appId), key),
    setByAppId: async (appId, key, value) => api.setAppData(requireAppId(appId), key, value),
    deleteByAppId: async (appId, key) => api.deleteAppData(requireAppId(appId), key),

    currentAppId: () => resolveAppId(),
  };
};
