const DEFAULT_APP_CONFIG = {
  width: 900,
  height: 600,
  resizable: true,
  minimizable: true,
  maximizable: true,
  isPin: false,
  hideWindowCloseButton: false,
  role: 'user',
  immersive: false,
  supports: {
    types: [],
    extensionGroups: [],
    priority: 0,
    directoryContext: false,
  },
};

export const defineApp = (config) => {
  return {
    ...DEFAULT_APP_CONFIG,
    ...config,
    supports: {
      ...DEFAULT_APP_CONFIG.supports,
      ...(config.supports || {}),
    },
  };
};

export const getFileExtension = (file) => {
  const name = typeof file === 'string' ? file : file?.name || file?.path || '';
  if (!name) return '';
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

export const toAppKey = (id) => {
  return String(id || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+/, '')
    .replace(/_+$/, '');
};

export const getAppTitle = (app) => {
  return app?.title || app?.name || '';
};

export const isDirectoryFile = (file) => {
  if (!file) return false;
  if (file.isDir) return true;
  return file.type === 'directory' || file.type === 'dir';
};

export const toAppFileRef = (file) => {
  if (!file?.path) return null;
  return { type: isDirectoryFile(file) ? 'dir' : 'file', path: file.path };
};

export const normalizeFileRef = (file) => {
  if (!file) return null;
  if (typeof file === 'string') return { path: file, type: 'file' };
  return {
    path: file.path,
    type: file.type || (file.isDir ? 'directory' : 'file'),
    name: file.name,
    ...file,
  };
};

export const normalizeFiles = (files) => {
  if (!files) return [];
  const list = Array.isArray(files) ? files : [files];
  return list.map(normalizeFileRef).filter(Boolean);
};

export const resolveBestAppForFile = (file, apps) => {
  if (!file || !apps) return null;
  const normalizedType = isDirectoryFile(file) ? 'directory' : file.type || 'file';
  const ext = getFileExtension(file);
  const candidates = Object.values(apps)
    .map((app, idx) => ({ app, idx }))
    .filter(({ app }) => {
      const supports = app?.supports;
      if (!supports) return false;

      const { types } = supports;

      if (Array.isArray(types) && types.includes(normalizedType)) {
        return true;
      }

      if (normalizedType === 'directory') return false;

      const groups = supports.extensionGroups;
      if (!Array.isArray(groups) || !ext) return false;
      return groups.some((g) => {
        const exts = g?.extensions;
        if (Array.isArray(exts)) return exts.includes(ext);
        if (exts && typeof exts.has === 'function') return exts.has(ext);
        return false;
      });
    })
    .sort((a, b) => {
      const pa = Number.isFinite(a.app?.supports?.priority) ? a.app.supports.priority : 0;
      const pb = Number.isFinite(b.app?.supports?.priority) ? b.app.supports.priority : 0;
      if (pa !== pb) return pb - pa;
      return a.idx - b.idx;
    })
    .map(({ app }) => app);

  return candidates[0] || apps.OPEN_WITH || apps.TEXT_EDITOR || null;
};

export const asArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

export const compactArray = (value) => {
  return asArray(value).filter(Boolean);
};

export const getParentDirPath = (p) => {
  const s = String(p || '');
  if (!s) return '';
  const idx = s.lastIndexOf('/');
  if (idx <= 0) return '/';
  return s.slice(0, idx) || '/';
};

export const getPathBaseName = (p) => {
  const s = String(p || '');
  if (!s) return '';
  const parts = s.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
};

export const joinPath = (basePath, childName) => {
  const base = String(basePath || '').trim();
  const child = String(childName || '').trim();

  if (!base || base === '/') return child ? `/${child.replace(/^\/+/, '')}` : '/';
  if (!child) return base.startsWith('/') ? base : `/${base}`;

  const left = base.endsWith('/') ? base.slice(0, -1) : base;
  const right = child.startsWith('/') ? child.slice(1) : child;
  const joined = `${left}/${right}`;
  return joined.startsWith('/') ? joined : `/${joined}`;
};

export const getFileLabel = (file) => String(file?.name || file?.label || file?.path || '');

export const reopenCurrentAppWindow = (os, next = {}) => {
  const appId = os?.window?.data?.appId;
  const apps = os?.apps;
  const openWindow = os?.stores?.windows?.openWindow;

  if (!appId || !apps || typeof openWindow !== 'function') return false;

  const app = Object.values(apps).find((a) => a && a.id === appId) || null;
  if (!app) return false;

  openWindow({
    ...app,
    ...(next || {}),
  });
  return true;
};

export const setDragPayload = (dataTransfer, payload) => {
  if (!dataTransfer) return false;
  try {
    const raw = JSON.stringify(payload || {});
    try { dataTransfer.setData('application/x-os-drag', raw); } catch { /* ignore */ }
    try { dataTransfer.setData('application/json', raw); } catch { /* ignore */ }
    return true;
  } catch {
    return false;
  }
};

export const getDragPayload = (dataTransfer) => {
  if (!dataTransfer) return null;
  const read = (t) => {
    try { return dataTransfer.getData(t); } catch { return ''; }
  };
  const raw = read('application/x-os-drag') || read('application/json');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const getDragFiles = (payload) => {
  if (!payload || typeof payload !== 'object') return [];
  if (payload.kind === 'files' && Array.isArray(payload.files)) return payload.files.filter(Boolean);
  if (payload.type === 'file-list' && Array.isArray(payload.files)) return payload.files.filter(Boolean);
  if (payload.type === 'desktop-file' && payload.sourcePath) return [{ path: payload.sourcePath, type: 'file' }];
  if (payload.file && typeof payload.file === 'object') return [payload.file];
  return [];
};
