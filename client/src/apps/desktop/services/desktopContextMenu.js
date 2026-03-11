import { unref } from 'vue';

export const normalizeContextFiles = (ctx) => {
  const files = unref(ctx?.files);
  if (Array.isArray(files)) return files.filter(Boolean);
  const file = unref(ctx?.file);
  return file ? [file] : [];
};

export const isArchiveFile = (file) => {
  if (!file || !file.name) return false;
  const ext = String(file.name).split('.').pop().toLowerCase();
  return ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext);
};

export const buildDesktopContextMenuOptions = ({ file, files, clipboard, cleanScreenActive } = {}) => {
  const clipboardValue = unref(clipboard);
  const hasClipboardContent = !!(clipboardValue && clipboardValue.files && clipboardValue.files.length > 0);
  const cleanActive = !!unref(cleanScreenActive);

  if (Array.isArray(files) && files.length > 1) {
    return [
      { label: '打开', key: 'open-multi', iconKey: 'folderOpen' },
      { label: '压缩', key: 'archive-multi', iconKey: 'archive' },
      { type: 'divider' },
      { label: '剪切', key: 'cut-multi', iconKey: 'scissors' },
      { label: '复制', key: 'copy-multi', iconKey: 'copy' },
      { type: 'divider' },
      { label: '删除', key: 'delete-multi', iconKey: 'trash2', danger: true }
    ];
  }

  if (file) {
    const isApp = file?.type === 'app';
    const isArchive = isArchiveFile(file);
    const options = [{ label: '打开', key: '打开', iconKey: 'folderOpen' }];

    if (!isApp) {
      options.push({ label: '打开方式...', key: 'open-with', iconKey: 'externalLink' });
    }

    if (!isApp && isArchive) {
      options.push({ label: '解压到当前', key: 'extract', iconKey: 'archive' });
    }

    if (!isApp) {
      options.push({ label: '重命名', key: '重命名', iconKey: 'edit2' });
      options.push({ label: '创建快捷方式', key: 'create-shortcut', iconKey: 'link2' });
      options.push({ type: 'divider' });

      const moreOptions = [
        { label: '剪切', key: '剪切', iconKey: 'scissors' },
        { label: '复制', key: '复制', iconKey: 'copy' },
        { label: '创建链接', key: 'create-link', iconKey: 'link2' },
        {
          label: file?.isFavorite ? '取消收藏' : '添加到收藏',
          key: 'favorite',
          iconKey: 'star',
          textColor: file?.isFavorite ? '#f59e0b' : undefined
        },
        { label: '属性', key: '属性', iconKey: 'info' }
      ];

      options.push({
        label: '更多操作',
        key: 'more-actions',
        iconKey: 'moreHorizontal',
        children: moreOptions
      });

      options.push({ type: 'divider' });
      options.push({ label: '删除', key: '删除', iconKey: 'trash2', danger: true });
    }

    return options;
  }

  const options = [
    { label: '新建文件夹', key: 'new-folder', iconKey: 'folder' },
    { label: '上传文件', key: 'upload', iconKey: 'uploadCloud' },
    { label: '属性', key: '属性', iconKey: 'info' }
  ];

  if (hasClipboardContent) {
    options.push({ label: '粘贴', key: '粘贴', iconKey: 'clipboard' });
  }

  options.push({ type: 'divider' });
  options.push({
    label: cleanActive ? '退出清屏' : '一键清屏',
    key: 'toggle-clean-screen',
    iconKey: cleanActive ? 'eye' : 'eyeOff'
  });
  options.push({ type: 'divider' });
  options.push({ label: '刷新', key: '刷新', iconKey: 'refreshCw' });
  options.push({ label: '重置布局', key: 'reset-desktop-layout', iconKey: 'rotateCcw' });
  options.push({ label: '设置', key: '设置', iconKey: 'settings' });

  return options;
};

export const createDesktopContextMenuHandlers = ({
  toast,
  apps,
  openWindow,
  fileOps,
  fetchDesktopItems,
  cleanScreen,
  createFolderAndRename,
  resetDesktopLayout,
  handleOpenFromMenu,
  handleRenameFromMenu,
  defaultDesktopPath = '/desktop',
} = {}) => {
  const normalizeFiles = (ctx) => normalizeContextFiles(ctx);

  const handleDelete = async (ctx) => {
    await fileOps.trash.delete({ files: normalizeFiles(ctx) });
  };

  const handleRestore = async (ctx) => {
    await fileOps.trash.restore({ files: normalizeFiles(ctx) });
  };

  const handleProperties = (ctx) => {
    fileOps.open.properties(normalizeFiles(ctx));
  };

  const handleCreateShortcut = (ctx) => {
    const files = normalizeFiles(ctx);
    const first = files[0];
    if (!first) return;
    fileOps.open.shortcut(first);
  };

  const handleCreateLink = async (ctx) => {
    const files = normalizeFiles(ctx);
    const first = files[0];
    if (!first) return;
    await fileOps.share.createLink({ file: first });
  };

  const handleFavorite = async (ctx) => {
    const files = normalizeFiles(ctx);
    const first = files[0];
    if (!first) return;
    await fileOps.favorite.toggle({ file: first });
  };

  const handleOpenWith = (ctx) => {
    const files = normalizeFiles(ctx);
    const first = files[0];
    if (!first) return;
    fileOps.open.with(first);
  };

  const handleExtract = async (ctx) => {
    const files = normalizeFiles(ctx);
    const first = files[0];
    if (!first) return;
    await fileOps.archive.extract(first);
  };

  const handleArchiveMulti = (ctx) => {
    const files = normalizeFiles(ctx);
    fileOps.archive.create(files);
  };

  const handleUpload = (ctx) => {
    const currentPath = String(unref(ctx?.currentPath) || defaultDesktopPath);
    fileOps.upload.open(currentPath);
  };

  return {
    '打开': (ctx) => handleOpenFromMenu(unref(ctx?.file)),
    'open-multi': (ctx) => normalizeFiles(ctx).forEach((f) => handleOpenFromMenu(f)),
    '重命名': (ctx) => {
      const files = normalizeFiles(ctx);
      if (files.length === 1) handleRenameFromMenu(files[0]);
      else toast.info('请选择单个文件进行重命名');
    },
    '剪切': (ctx) => fileOps.clipboard.cut(normalizeFiles(ctx)),
    'cut-multi': (ctx) => fileOps.clipboard.cut(normalizeFiles(ctx)),
    '复制': (ctx) => fileOps.clipboard.copy(normalizeFiles(ctx)),
    'copy-multi': (ctx) => fileOps.clipboard.copy(normalizeFiles(ctx)),
    '粘贴': async (ctx) => {
      await fileOps.clipboard.paste({
        targetPath: String(unref(ctx?.currentPath) || defaultDesktopPath),
        refresh: fetchDesktopItems,
      });
    },
    '删除': handleDelete,
    'delete-multi': handleDelete,
    restore: handleRestore,
    'restore-multi': handleRestore,
    favorite: handleFavorite,
    'create-shortcut': handleCreateShortcut,
    'create-link': handleCreateLink,
    'open-with': handleOpenWith,
    extract: handleExtract,
    'archive-multi': handleArchiveMulti,
    '属性': handleProperties,
    '刷新': fetchDesktopItems,
    '设置': () => apps?.SETTINGS && openWindow(apps.SETTINGS),
    upload: handleUpload,
    'reset-desktop-layout': resetDesktopLayout,
    'new-folder': createFolderAndRename,
    'toggle-clean-screen': () => cleanScreen()
  };
};
