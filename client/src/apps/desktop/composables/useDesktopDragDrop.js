export const useDesktopDragDrop = ({
  desktopItems,
  selectedIds,
  desktopLayout,
  saveDesktopLayout,
  fetchDesktopItems,
  fileOps,
  toast,
  triggerGlobalRefresh,
  ensureDragSession,
  clearDragSession,
  dragSession,
  setCustomDragImageFromEl,
  computeGridDropIndex,
  canPlaceIconPathsAtIndex,
  cellFromIdxOrNull,
  getDragPayload,
  getDragFiles,
  setDragPayload,
  isDirectoryFile,
  defaultDesktopDir = '/desktop',
} = {}) => {
  const handleDragStart = (item, e) => {
    if (item.type !== 'file' || !item.file) return;
    if (e.dataTransfer) {
      if (!selectedIds.value.has(item.id)) {
        selectedIds.value.clear();
        selectedIds.value.add(item.id);
      }

      const dragFiles = desktopItems.value
        .filter((i) => selectedIds.value.has(i.id) && i.type === 'file')
        .map((i) => i.file);

      const dragData = { kind: 'files', files: dragFiles, source: 'desktop' };

      ensureDragSession({ type: 'file-list', movingPaths: dragFiles.map((f) => f?.path).filter(Boolean) });
      const iconHost = e.target?.closest?.('[data-id]');
      if (iconHost) setCustomDragImageFromEl(e, iconHost);
      requestAnimationFrame(() => {
        if (dragSession.value?.type === 'file-list') {
          dragSession.value.hideSource = true;
        }
      });
      setDragPayload(e.dataTransfer, dragData);
      e.dataTransfer.effectAllowed = 'move';
    }
  };

  const handleDragEnd = () => {
    clearDragSession({ restore: true });
  };

  const handleDragOver = (e) => {
    if (!e) return;

    const session = dragSession.value;
    let iconPaths = session?.type === 'file-list' ? session?.movingPaths : null;

    let dragData = null;
    if (!iconPaths && e?.dataTransfer) {
      const dragDataStr = e.dataTransfer.getData('application/json');
      if (dragDataStr) {
        try {
          dragData = JSON.parse(dragDataStr);
        } catch {
          dragData = null;
        }
      }
    }

    if (!iconPaths && dragData?.type === 'file-list' && dragData.source === 'desktop' && Array.isArray(dragData.files)) {
      iconPaths = dragData.files.map((f) => f?.path).filter(Boolean);
      ensureDragSession({ type: 'file-list', movingPaths: iconPaths });
    }

    if (Array.isArray(iconPaths) && iconPaths.length) {
      // Always allow move to prevent native fly-back animation on drop
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDropOnFolder = async (targetItem, e) => {
    if (targetItem.type !== 'file' || !isDirectoryFile(targetItem.file)) return;

    try {
      const dragData = getDragPayload(e.dataTransfer);
      const dragFiles = getDragFiles(dragData);
      if (dragFiles.length > 0) {
        e.stopPropagation();

        let movedCount = 0;
        for (const file of dragFiles) {
          const sourcePath = String(file?.path || '');
          if (!sourcePath) continue;
          if (sourcePath === targetItem.file.path) continue;

          const fileName = sourcePath.split('/').pop();
          const newPath = targetItem.file.path + '/' + fileName;

          const sourceDir = sourcePath.substring(0, sourcePath.lastIndexOf('/')) || '/';
          if (sourceDir === targetItem.file.path) continue;

          try {
            const res = await fileOps.fs.move({ from: sourcePath, to: newPath, refresh: false });
            if (res.ok) movedCount++;
          } catch {
            toast.error('移动项目失败');
          }
        }

        if (movedCount > 0) {
          toast.success('已移动到文件夹');
          triggerGlobalRefresh();
          await fileOps.refresh(fetchDesktopItems);
        }
        return;
      }

      if (!dragData?.sourcePath) return;
      if (dragData.sourcePath === targetItem.file.path) return;

      const fileName = dragData.sourcePath.split('/').pop();
      const newPath = targetItem.file.path + '/' + fileName;

      await fileOps.fs.move({ from: dragData.sourcePath, to: newPath, refresh: false });
      toast.success('已移动到文件夹');
      triggerGlobalRefresh();
      await fileOps.refresh(fetchDesktopItems);
    } catch {
      toast.error('desktop.moveFailed');
    }
  };

  const handleDrop = async (e) => {
    try {
      const dragData = getDragPayload(e.dataTransfer);
      if (!dragData) return;
      const { dropIdx } = computeGridDropIndex(e);

      const dragFiles = getDragFiles(dragData);
      if (dragFiles.length > 0) {
        const currentDir = defaultDesktopDir;
        const planned = [];
        const toMove = [];

        for (const file of dragFiles) {
          const sourcePath = String(file?.path || '');
          if (!sourcePath) continue;
          const sourceDir = sourcePath.substring(0, sourcePath.lastIndexOf('/')) || '/';

          if (sourceDir === currentDir) {
            planned.push(sourcePath);
            continue;
          }

          const fileName = sourcePath.split('/').pop();
          const newPath = currentDir + '/' + fileName;
          planned.push(newPath);
          toMove.push({ from: sourcePath, to: newPath });
        }

        if (!planned.length) return;
        const exclude = new Set(planned);
        if (!canPlaceIconPathsAtIndex(planned, dropIdx, { excludePaths: exclude })) {
          toast.info('位置已被占用');
          return;
        }

        let movedCount = 0;
        for (const op of toMove) {
          try {
            const res = await fileOps.fs.move({ from: op.from, to: op.to, refresh: false });
            if (res.ok) movedCount++;
          } catch {
            toast.error('移动项目失败');
          }
        }

        if (movedCount > 0) triggerGlobalRefresh();
        if (toMove.length > 0) await fileOps.refresh(fetchDesktopItems);

        const nextLayout = { ...(desktopLayout.value || {}) };
        for (let i = 0; i < planned.length; i++) {
          const cell = cellFromIdxOrNull(dropIdx + i);
          if (!cell) return;
          nextLayout[planned[i]] = { idx: cell.idx };
        }
        desktopLayout.value = nextLayout;
        saveDesktopLayout();
        return;
      }

      if (!dragData.sourcePath || dragData.type !== 'desktop-file') return;

      const currentDir = defaultDesktopDir;
      const sourcePath = String(dragData.sourcePath || '');
      const lastSlashIndex = sourcePath.lastIndexOf('/');
      const sourceDir = lastSlashIndex === 0 ? '/' : dragData.sourcePath.substring(0, lastSlashIndex);

      const fileName = dragData.sourcePath.split('/').pop();
      const newPath = currentDir + '/' + fileName;

      const planned = [sourceDir !== currentDir ? newPath : sourcePath];
      if (!canPlaceIconPathsAtIndex(planned, dropIdx, { excludePaths: new Set(planned) })) {
        toast.info('位置已被占用');
        return;
      }

      if (sourceDir !== currentDir) {
        await fileOps.fs.move({ from: sourcePath, to: newPath, refresh: false });
        triggerGlobalRefresh();
        await fileOps.refresh(fetchDesktopItems);
      }

      const cell = cellFromIdxOrNull(dropIdx);
      if (!cell) return;
      desktopLayout.value = { ...(desktopLayout.value || {}), [planned[0]]: { idx: cell.idx } };
      saveDesktopLayout();
    } catch {
      toast.error('desktop.moveFailed');
    } finally {
      clearDragSession({ restore: false });
    }
  };

  return {
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    handleDropOnFolder,
  };
};
