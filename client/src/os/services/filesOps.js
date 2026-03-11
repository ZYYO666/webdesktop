import { defineStore, storeToRefs } from 'pinia';
import { ref, watch, unref } from 'vue';
import { File } from 'lucide-vue-next';
import { createApi } from '../api/index';
import { uiModule } from '../ui/index';
import { compactArray, getFileExtension, getFileLabel, getPathBaseName, joinPath, resolveBestAppForFile, toAppFileRef } from '../utils/index';

const createRunner = ({ toast } = {}) => {
  return async (fn, { okMessage = null, failMessage = null, silent = false } = {}) => {
    try {
      const data = await fn();
      if (!silent && okMessage && toast?.success) toast.success(okMessage);
      return { ok: true, data, error: null };
    } catch (error) {
      const msg = error?.message ? String(error.message) : '';
      if (!silent && toast?.error) toast.error(failMessage ? String(failMessage).replace('{message}', msg) : (msg || '操作失败'));
      return { ok: false, data: null, error };
    }
  };
};

const getCurrentPath = (currentPath, fallback = '/') => String(unref(currentPath) || fallback);

export const useFileStore = defineStore('files', () => {
  const api = createApi();

  const clipboard = ref(null);
  const refreshTrigger = ref(0);
  const searchPath = ref('/');
  const searchQuery = ref('');
  const searchResults = ref([]);
  const isSearching = ref(false);
  const searchSeq = ref(0);
  let searchTimer = null;

  const setSearchPath = (path) => {
    searchPath.value = path;
  };

  const setSearchQuery = (query) => {
    searchQuery.value = query;
  };

  const normalizeSearchResults = (res) => {
    const list = Array.isArray(res) ? res : (Array.isArray(res?.files) ? res.files : []);
    return list
      .filter(Boolean)
      .map((file) => ({
        ...file,
        name: file.name || getPathBaseName(file.path),
        type: (file.isDir || file.type === 'directory' || file.type === 'dir') ? 'directory' : 'file'
      }))
      .filter((file) => Boolean(file.path));
  };

  const runSearch = async (query, path) => {
    const seq = ++searchSeq.value;
    isSearching.value = true;

    try {
      const res = await api.searchFiles(query, path);
      if (seq !== searchSeq.value) return;
      searchResults.value = normalizeSearchResults(res);
    } catch (e) {
      if (seq !== searchSeq.value) return;
      searchResults.value = [];
      const message = e?.message ? String(e.message) : '未知错误';
      uiModule.toast.error(`搜索失败: ${message}`);
    } finally {
      if (seq === searchSeq.value) isSearching.value = false;
    }
  };

  watch(
    [searchQuery, searchPath],
    ([q, p]) => {
      const query = String(q || '').trim();
      const path = String(p || '/').trim() || '/';

      if (searchTimer) clearTimeout(searchTimer);

      if (!query) {
        searchSeq.value++;
        isSearching.value = false;
        searchResults.value = [];
        return;
      }

      searchTimer = setTimeout(() => {
        runSearch(query, path);
      }, 250);
    },
    { immediate: true }
  );

  const setClipboard = (data) => {
    clipboard.value = data;
  };

  const triggerRefresh = () => {
    refreshTrigger.value++;
  };

  const cut = (fileOrFiles) => {
    const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
    setClipboard({ files, action: 'cut' });
    uiModule.toast.info(`已剪切 ${files.length} 个文件`);
  };

  const copy = (fileOrFiles) => {
    const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
    setClipboard({ files, action: 'copy' });
    uiModule.toast.info(`已复制 ${files.length} 个文件`);
  };

  const paste = async (targetPathOverride = null) => {
    if (!clipboard.value) return;
    const { toast } = uiModule;

    const { files, action } = clipboard.value;
    const currentPath = targetPathOverride || '/';

    const promises = files.map(async (file) => {
      try {
        const fileName = getPathBaseName(file.path);
        const destPath = joinPath(currentPath, fileName);

        if (action === 'cut') {
          if (file.path === destPath) return false;
          await api.moveFile(file.path, destPath);
        } else {
          await api.copyFile(file.path, destPath);
        }
        return true;
      } catch (e) {
        toast.error(`粘贴失败: ${file.name}`);
        return false;
      }
    });

    const results = await Promise.all(promises);
    const successCount = results.filter(Boolean).length;

    if (successCount > 0) {
      toast.success(action === 'cut' ? `已移动 ${successCount} 个文件` : `已复制 ${successCount} 个文件`);
      triggerRefresh();
      if (action === 'cut') {
        clipboard.value = null;
      }
    }
  };

  return {
    clipboard,
    refreshTrigger,
    searchPath,
    searchQuery,
    searchResults,
    isSearching,
    setSearchPath,
    setSearchQuery,
    setClipboard,
    triggerRefresh,
    cut,
    copy,
    paste
  };
});

const createFilesPureApi = ({ api } = {}) => {
  const run = createRunner();

  const createOps = ({ currentPath = null } = {}) => {
    const dir = {
      mkdir: async ({ dirPath, name } = {}) => {
        const base = String(dirPath || getCurrentPath(currentPath, '/'));
        const n = String(name || '').trim();
        if (!n) return { ok: false, data: null, error: new Error('name is required') };
        return await run(() => api.createDirectory(base, n));
      },
    };

    const fs = {
      rename: async ({ path, newName } = {}) => {
        const p = String(path || '').trim();
        const n = String(newName || '').trim();
        if (!p || !n) return { ok: false, data: null, error: new Error('path and newName are required') };
        return await run(() => api.renameFile(p, n));
      },
      move: async ({ from, to } = {}) => {
        const src = String(from || '').trim();
        const dest = String(to || '').trim();
        if (!src || !dest) return { ok: false, data: null, error: new Error('from and to are required') };
        if (src === dest) return { ok: true, data: null, error: null };
        return await run(() => api.moveFile(src, dest));
      },
      copy: async ({ from, to } = {}) => {
        const src = String(from || '').trim();
        const dest = String(to || '').trim();
        if (!src || !dest) return { ok: false, data: null, error: new Error('from and to are required') };
        return await run(() => api.copyFile(src, dest));
      },
      moveInto: async ({ from, dirPath } = {}) => {
        const src = String(from || '').trim();
        const dirPathStr = String(dirPath || getCurrentPath(currentPath, '/'));
        const fileName = getPathBaseName(src);
        if (!src || !fileName) return { ok: false, data: null, error: new Error('from is required') };
        return await fs.move({ from: src, to: joinPath(dirPathStr, fileName) });
      },
    };

    const trash = {
      delete: async ({ files } = {}) => {
        const list = compactArray(files);
        if (list.length === 0) return { ok: false, data: null, error: new Error('files is empty') };
        return await run(() => Promise.all(list.map((f) => api.deleteFile(f.path))));
      },
      restore: async ({ files } = {}) => {
        const list = compactArray(files);
        if (list.length === 0) return { ok: false, data: null, error: new Error('files is empty') };
        return await run(() => Promise.all(list.map((f) => api.restoreFile(f.path))));
      },
    };

    const favorite = {
      add: async ({ path } = {}) => {
        const p = String(path || '').trim();
        if (!p) return { ok: false, data: null, error: new Error('path is required') };
        return await run(() => api.addFavorite(p));
      },
      remove: async ({ path } = {}) => {
        const p = String(path || '').trim();
        if (!p) return { ok: false, data: null, error: new Error('path is required') };
        return await run(() => api.removeFavorite(p));
      },
      toggle: async ({ file } = {}) => {
        if (!file?.path) return { ok: false, data: null, error: new Error('file.path is required') };
        return await run(() => (file.isFavorite ? api.removeFavorite(file.path) : api.addFavorite(file.path)));
      },
    };

    const share = {
      create: async ({ path } = {}) => {
        const p = String(path || '').trim();
        if (!p) return { ok: false, data: null, error: new Error('path is required') };
        return await run(() => api.createShare(p));
      },
    };

    const archive = {
      compress: async ({ files, archiveName, parentPath } = {}) => {
        const list = compactArray(files);
        const name = String(archiveName || '').trim();
        const parent = String(parentPath || getCurrentPath(currentPath, '/'));
        if (list.length === 0) return { ok: false, data: null, error: new Error('files is empty') };
        if (!name) return { ok: false, data: null, error: new Error('archiveName is required') };
        return await run(() => api.compressFiles(list, name, parent));
      },
      extract: async ({ path, destination } = {}) => {
        const p = String(path || '').trim();
        const dest = String(destination || '').trim();
        if (!p || !dest) return { ok: false, data: null, error: new Error('path and destination are required') };
        return await run(() => api.extractFile(p, dest));
      },
    };

    return {
      dir,
      fs,
      trash,
      favorite,
      share,
      archive,
      currentPath: () => getCurrentPath(currentPath, '/'),
    };
  };

  return { createOps };
};

const createFilesOpsApi = ({ api, ui, stores, apps } = {}) => {
  const toast = ui?.toast;
  const dialog = ui?.dialog;
  const copyToClipboard = ui?.copyToClipboard;

  const openWindow = stores?.windows?.openWindow;
  const openFile = stores?.windows?.openFile;
  const fileStore = stores?.files;

  const run = createRunner({ toast });
  const pure = createFilesPureApi({ api });

  const confirm = async (message, title = null) => {
    if (dialog?.confirm) return await dialog.confirm(message, title || undefined);
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') return window.confirm(message);
    return false;
  };

  const refreshAfter = async ({ refresh }) => {
    if (refresh === false) return;
    if (typeof refresh === 'function') {
      await refresh();
      return;
    }
    if (typeof fileStore?.triggerRefresh === 'function') fileStore.triggerRefresh();
  };

  const createOps = ({ currentPath = null, refresh = null } = {}) => {
    const ctxRefresh = async (overrideRefresh = null) => {
      if (overrideRefresh === false) return;
      await refreshAfter({ refresh: typeof overrideRefresh === 'function' ? overrideRefresh : refresh });
    };

    const core = pure.createOps({ currentPath });

    const clipboard = {
      cut: (files) => {
        if (typeof fileStore?.cut !== 'function') return { ok: false, data: null, error: new Error('clipboard unavailable') };
        fileStore.cut(compactArray(files));
        return { ok: true, data: null, error: null };
      },
      copy: (files) => {
        if (typeof fileStore?.copy !== 'function') return { ok: false, data: null, error: new Error('clipboard unavailable') };
        fileStore.copy(compactArray(files));
        return { ok: true, data: null, error: null };
      },
      paste: async ({ targetPath = null, refresh: overrideRefresh = null } = {}) => {
        if (typeof fileStore?.paste !== 'function') return { ok: false, data: null, error: new Error('clipboard unavailable') };
        const target = String(targetPath || getCurrentPath(currentPath, '/'));
        const res = await run(() => fileStore.paste(target), { failMessage: '粘贴失败: {message}' });
        if (res.ok) await ctxRefresh(overrideRefresh);
        return res;
      },
    };

    const dir = {
      mkdir: async ({ dirPath, name, refresh: overrideRefresh = null } = {}) => {
        const res = await run(() => core.dir.mkdir({ dirPath, name }).then((r) => (r.ok ? r.data : Promise.reject(r.error))), { failMessage: '创建失败: {message}' });
        if (res.ok) await ctxRefresh(overrideRefresh);
        return res;
      },
    };

    const fs = {
      rename: async ({ path, newName, refresh: overrideRefresh = null } = {}) => {
        const res = await run(() => core.fs.rename({ path, newName }).then((r) => (r.ok ? r.data : Promise.reject(r.error))), { failMessage: '重命名失败: {message}' });
        if (res.ok) await ctxRefresh(overrideRefresh);
        return res;
      },
      move: async ({ from, to, refresh: overrideRefresh = null } = {}) => {
        const res = await run(() => core.fs.move({ from, to }).then((r) => (r.ok ? r.data : Promise.reject(r.error))), { failMessage: '移动失败: {message}' });
        if (res.ok) await ctxRefresh(overrideRefresh);
        return res;
      },
      copy: async ({ from, to, refresh: overrideRefresh = null } = {}) => {
        const res = await run(() => core.fs.copy({ from, to }).then((r) => (r.ok ? r.data : Promise.reject(r.error))), { failMessage: '复制失败: {message}' });
        if (res.ok) await ctxRefresh(overrideRefresh);
        return res;
      },
      moveInto: async ({ from, dirPath, refresh: overrideRefresh = null } = {}) => {
        const res = await run(() => core.fs.moveInto({ from, dirPath }).then((r) => (r.ok ? r.data : Promise.reject(r.error))), { failMessage: '移动失败: {message}' });
        if (res.ok) await ctxRefresh(overrideRefresh);
        return res;
      },
    };

    const trash = {
      delete: async ({ files, confirm: needConfirm = true, refresh: overrideRefresh = null } = {}) => {
        const list = compactArray(files);
        if (list.length === 0) return { ok: false, data: null, error: new Error('files is empty') };
        if (needConfirm) {
          const label = list.length > 1 ? `${list.length} 个项目` : getFileLabel(list[0]);
          const ok = await confirm(`确定要删除 ${label} 吗？`);
          if (!ok) return { ok: false, data: null, error: null };
        }
        const res = await run(() => core.trash.delete({ files: list }).then((r) => (r.ok ? r.data : Promise.reject(r.error))), {
          okMessage: '删除成功',
          failMessage: '删除失败: {message}',
        });
        if (res.ok) await ctxRefresh(overrideRefresh);
        return res;
      },
      restore: async ({ files, refresh: overrideRefresh = null } = {}) => {
        const res = await run(() => core.trash.restore({ files }).then((r) => (r.ok ? r.data : Promise.reject(r.error))), {
          okMessage: '还原成功',
          failMessage: '还原失败: {message}',
        });
        if (res.ok) await ctxRefresh(overrideRefresh);
        return res;
      },
    };

    const favorite = {
      toggle: async ({ file, refresh: overrideRefresh = null } = {}) => {
        const res = await run(() => core.favorite.toggle({ file }).then((r) => (r.ok ? r.data : Promise.reject(r.error))), { failMessage: '操作失败: {message}' });
        if (res.ok) await ctxRefresh(overrideRefresh);
        return res;
      },
    };

    const share = {
      createLink: async ({ file } = {}) => {
        if (!file?.path) return { ok: false, data: null, error: new Error('file.path is required') };
        const res = await run(() => core.share.create({ path: file.path }).then((r) => (r.ok ? r.data : Promise.reject(r.error))), {
          failMessage: '创建链接失败: {message}',
        });
        if (!res.ok) return res;
        const id = res.data?.id;
        if (!id) {
          if (toast?.error) toast.error('创建链接失败');
          return { ok: false, data: null, error: new Error('share id missing') };
        }
        const link = `${window.location.origin}/s/${id}`;
        await run(async () => {
          if (typeof copyToClipboard === 'function') await copyToClipboard(link);
        }, { silent: true });
        if (toast?.success) toast.success('链接已复制');
        return { ok: true, data: link, error: null };
      },
    };

    const open = {
      file: (file, appId = null) => {
        if (typeof openFile !== 'function') return { ok: false, data: null, error: new Error('openFile unavailable') };
        return { ok: !!openFile(file, appId), data: null, error: null };
      },
      properties: (files = null) => {
        if (!apps?.PROPERTIES) {
          if (toast?.error) toast.error('属性应用未找到');
          return { ok: false, data: null, error: new Error('PROPERTIES app missing') };
        }
        if (typeof openWindow !== 'function') return { ok: false, data: null, error: new Error('openWindow unavailable') };
        const list = compactArray(files);
        const targetFiles = list.length > 0 ? list.map(toAppFileRef).filter(Boolean) : [{ type: 'dir', path: getCurrentPath(currentPath, '/') }];
        openWindow({ ...apps.PROPERTIES, componentProps: { files: targetFiles } });
        return { ok: true, data: null, error: null };
      },
      with: (file) => {
        if (!apps?.OPEN_WITH) return { ok: false, data: null, error: new Error('OPEN_WITH app missing') };
        if (typeof openWindow !== 'function') return { ok: false, data: null, error: new Error('openWindow unavailable') };
        const ref = toAppFileRef(file);
        if (!ref) return { ok: false, data: null, error: new Error('invalid file') };
        openWindow({ ...apps.OPEN_WITH, componentProps: { files: [ref] } });
        return { ok: true, data: null, error: null };
      },
      shortcut: (file, { defaultDestDir = '/desktop' } = {}) => {
        if (!apps?.SHORTCUT_CREATOR) return { ok: false, data: null, error: new Error('SHORTCUT_CREATOR app missing') };
        if (typeof openWindow !== 'function') return { ok: false, data: null, error: new Error('openWindow unavailable') };
        if (!file?.path) return { ok: false, data: null, error: new Error('file.path is required') };
        openWindow({
          ...apps.SHORTCUT_CREATOR,
          componentProps: { sourceFile: file, defaultDestDir: String(defaultDestDir || '/desktop') }
        });
        return { ok: true, data: null, error: null };
      },
    };

    const archive = {
      extract: async (file) => {
        if (!apps?.ARCHIVE) return { ok: false, data: null, error: new Error('ARCHIVE app missing') };
        if (typeof openWindow !== 'function') return { ok: false, data: null, error: new Error('openWindow unavailable') };
        const ref = toAppFileRef(file);
        if (!ref) return { ok: false, data: null, error: new Error('invalid file') };
        await openWindow({
          ...apps.ARCHIVE,
          title: '解压文件',
          componentProps: { files: [ref] }
        });
        return { ok: true, data: null, error: null };
      },
      create: (files) => {
        if (!apps?.ARCHIVE) return { ok: false, data: null, error: new Error('ARCHIVE app missing') };
        if (typeof openWindow !== 'function') return { ok: false, data: null, error: new Error('openWindow unavailable') };
        const list = compactArray(files);
        if (list.length === 0) return { ok: false, data: null, error: new Error('files is empty') };
        openWindow({ ...apps.ARCHIVE, componentProps: { files: list } });
        return { ok: true, data: null, error: null };
      },
    };

    const upload = {
      open: (dirPath = null, { autoOpenSelect = false } = {}) => {
        if (!apps?.UPLOADER) return { ok: false, data: null, error: new Error('UPLOADER app missing') };
        if (typeof openWindow !== 'function') return { ok: false, data: null, error: new Error('openWindow unavailable') };
        const path = String(dirPath || getCurrentPath(currentPath, '/'));
        openWindow({
          ...apps.UPLOADER,
          componentProps: { files: [{ type: 'dir', path }], autoOpenSelect: !!autoOpenSelect }
        });
        return { ok: true, data: null, error: null };
      },
    };

    return {
      clipboard,
      dir,
      fs,
      trash,
      favorite,
      share,
      open,
      archive,
      upload,
      currentPath: () => getCurrentPath(currentPath, '/'),
      refresh: ctxRefresh,
    };
  };

  return { createOps };
};

export const createFilesApi = ({ api, ui, stores, apps } = {}) => {
  const pure = createFilesPureApi({ api });
  const uiApi = createFilesOpsApi({ api, ui, stores, apps });
  const resolveFileIcon = (file) => {
    if (!file) return null;

    const ext = getFileExtension(file);
    const base = { kind: 'svg', fgClass: 'text-slate-700', bgClass: 'bg-slate-100' };

    const fromApp = (app) => {
      const groups = Array.isArray(app?.supports?.extensionGroups) ? app.supports.extensionGroups : [];
      for (const g of groups) {
        const exts = g?.extensions;
        const matched = Array.isArray(exts) ? exts.includes(ext) : exts && typeof exts.has === 'function' ? exts.has(ext) : false;
        if (!matched) continue;
        if (!g.icon) continue;
        return {
          kind: 'svg',
          icon: g.icon,
          fgClass: g.fgClass || base.fgClass,
          bgClass: g.bgClass || base.bgClass,
          isVideo: g.isVideo === true
        };
      }

      return null;
    };

    const best = resolveBestAppForFile(file, apps);
    if (best?.resolveFileIcon && typeof best.resolveFileIcon === 'function') {
      const custom = best.resolveFileIcon({ file, api, apps });
      if (custom) return custom;
    }

    const resolvedFromBest = fromApp(best);
    if (resolvedFromBest) return resolvedFromBest;

    const openWith = apps?.OPEN_WITH || Object.values(apps || {}).find((a) => a?.id === 'open-with') || null;
    if (openWith && openWith !== best) {
      const resolvedFromOpenWith = fromApp(openWith);
      if (resolvedFromOpenWith) return resolvedFromOpenWith;
    }

    return { ...base, icon: File };
  };

  return {
    useRefs: () => {
      const store = stores?.files;
      if (!store) return {};
      return storeToRefs(store);
    },
    triggerRefresh: () => {
      const store = stores?.files;
      if (typeof store?.triggerRefresh !== 'function') return { ok: false, data: null, error: new Error('files store unavailable') };
      store.triggerRefresh();
      return { ok: true, data: null, error: null };
    },
    search: {
      setPath: (path) => {
        const store = stores?.files;
        if (typeof store?.setSearchPath !== 'function') return { ok: false, data: null, error: new Error('files store unavailable') };
        store.setSearchPath(path);
        return { ok: true, data: null, error: null };
      },
      setQuery: (query) => {
        const store = stores?.files;
        if (typeof store?.setSearchQuery !== 'function') return { ok: false, data: null, error: new Error('files store unavailable') };
        store.setSearchQuery(query);
        return { ok: true, data: null, error: null };
      },
    },
    clipboard: {
      cut: (files) => {
        const store = stores?.files;
        if (typeof store?.cut !== 'function') return { ok: false, data: null, error: new Error('files store unavailable') };
        store.cut(files);
        return { ok: true, data: null, error: null };
      },
      copy: (files) => {
        const store = stores?.files;
        if (typeof store?.copy !== 'function') return { ok: false, data: null, error: new Error('files store unavailable') };
        store.copy(files);
        return { ok: true, data: null, error: null };
      },
      paste: async ({ targetPath = null } = {}) => {
        const store = stores?.files;
        if (typeof store?.paste !== 'function') return { ok: false, data: null, error: new Error('files store unavailable') };
        const path = String(targetPath || '/');
        const run = createRunner({ toast: ui?.toast });
        return await run(() => store.paste(path), { failMessage: '粘贴失败: {message}' });
      },
    },
    createOps: uiApi.createOps,
    createPureOps: pure.createOps,
    getIcon: (file) => resolveFileIcon(file),
  };
};
