import { onMounted, onUnmounted, reactive, ref } from 'vue';
import { isDirectoryFile } from '@/os';

export const useDesktopLayout = ({
  desktopItems,
  desktopGridRef,
  baseCellW = 112,
  baseCellH = 120,
  storageKey = 'desktop-layout-v3',
} = {}) => {
  const desktopLayout = ref({});
  const didLoadLayout = ref(false);
  const gridMetrics = reactive({ width: 0, height: 0, cols: 1, rows: 1, cellW: baseCellW, cellH: baseCellH, gridWidth: 0, gridHeight: 0 });

  const getLayoutKey = (item) => {
    if (item?.type === 'file' && item?.file?.path) return item.file.path;
    return item?.id;
  };

  const getCurrentLayoutKey = () => storageKey;

  const loadDesktopLayout = () => {
    try {
      const raw = localStorage.getItem(getCurrentLayoutKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
      return {};
    } catch {
      return {};
    }
  };

  const saveDesktopLayout = () => {
    try {
      localStorage.setItem(getCurrentLayoutKey(), JSON.stringify(desktopLayout.value || {}));
    } catch {
      // ignore storage errors
    }
  };

  const clampInt = (n, min, max) => Math.min(max, Math.max(min, Math.floor(n)));

  const totalCells = () => {
    const cols = Number(gridMetrics.cols) || 0;
    const rows = Number(gridMetrics.rows) || 0;
    return cols * rows;
  };

  const cellFromIdxOrNull = (idx) => {
    const total = totalCells();
    const v = Number(idx);
    if (!Number.isFinite(v)) return null;
    const vInt = Math.floor(v);
    if (total <= 0) return null;
    if (vInt < 0 || vInt >= total) return null;
    const cols = Number(gridMetrics.cols) || 0;
    const rows = Number(gridMetrics.rows) || 0;
    if (cols <= 0 || rows <= 0) return null;
    const colFromRight = Math.floor(vInt / rows);
    const row = vInt % rows;
    const col = cols - 1 - colFromRight;
    if (col < 0 || col >= cols) return null;
    return { col, row, idx: vInt, key: `${col},${row}` };
  };

  const idxFromPos = (pos) => {
    const idx = Number(pos?.idx);
    if (!Number.isFinite(idx) || idx < 0) return null;
    return Math.floor(idx);
  };

  const normalizeLayoutToIdx = () => {
    const cur = desktopLayout.value || {};
    const next = { ...cur };
    let changed = false;

    Object.entries(cur).forEach(([k, pos]) => {
      const idx = idxFromPos(pos);
      if (idx === null) return;
      if (pos && typeof pos === 'object' && Number.isFinite(Number(pos.idx)) && Math.floor(Number(pos.idx)) === idx) return;
      next[String(k)] = { idx };
      changed = true;
    });

    if (changed) desktopLayout.value = next;
  };

  const isIconPosValid = (pos) => {
    const idx = idxFromPos(pos);
    const total = totalCells();
    if (idx === null) return false;
    if (total <= 0) return false;
    if (idx < 0 || idx >= total) return false;
    return true;
  };

  const occupyIconsCells = (occupied, excludePaths = new Set()) => {
    (desktopItems?.value || []).forEach((item) => {
      const key = getLayoutKey(item);
      if (!key) return;
      if (excludePaths.has(key)) return;
      const pos = desktopLayout.value?.[key];
      const idx = idxFromPos(pos);
      if (idx === null) return;
      const cell = cellFromIdxOrNull(idx);
      if (!cell) return;
      occupied.add(cell.key);
    });
  };

  const findFirstFreeIconCell = (occupied) => {
    const total = totalCells();
    if (total <= 0) return null;
    for (let idx = 0; idx < total; idx += 1) {
      const cell = cellFromIdxOrNull(idx);
      if (!cell) continue;
      if (occupied.has(cell.key)) continue;
      return cell;
    }
    return null;
  };

  const fillMissingDesktopIconLayouts = ({ persist } = { persist: true }) => {
    const nextLayout = { ...(desktopLayout.value || {}) };

    const occupied = new Set();

    const fileItems = (desktopItems?.value || []).filter((i) => i?.type === 'file' && i?.file?.path);
    fileItems.sort((a, b) => {
      const ad = isDirectoryFile(a?.file) ? 0 : 1;
      const bd = isDirectoryFile(b?.file) ? 0 : 1;
      if (ad !== bd) return ad - bd;
      return String(a.file.path || '').localeCompare(String(b.file.path || ''), 'zh-Hans-CN', { numeric: true, sensitivity: 'base' });
    });

    fileItems.forEach((it) => {
      const path = String(it.file.path || '');
      if (!path) return;
      const cur = nextLayout[path];
      const curIdx = idxFromPos(cur);
      const curCell = curIdx === null ? null : cellFromIdxOrNull(curIdx);
      if (curCell && !occupied.has(curCell.key)) {
        nextLayout[path] = { idx: curCell.idx };
        occupied.add(curCell.key);
        return;
      }
      const free = findFirstFreeIconCell(occupied);
      if (!free) return;
      nextLayout[path] = { idx: free.idx };
      occupied.add(free.key);
    });

    desktopLayout.value = nextLayout;
    if (persist) saveDesktopLayout();
  };

  const updateGridMetrics = () => {
    const el = desktopGridRef?.value;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    const prevCols = gridMetrics.cols;
    const prevRows = gridMetrics.rows;

    normalizeLayoutToIdx();

    const minCellW = Math.max(1, Number(baseCellW) || 1);
    const minCellH = Math.max(1, Number(baseCellH) || 1);
    const cols = Math.max(1, Math.floor(rect.width / minCellW));
    const rows = Math.max(1, Math.floor(rect.height / minCellH));
    const cellW = rect.width / cols;
    const cellH = rect.height / rows;

    gridMetrics.width = rect.width;
    gridMetrics.height = rect.height;
    gridMetrics.cols = cols;
    gridMetrics.rows = rows;
    gridMetrics.cellW = cellW;
    gridMetrics.cellH = cellH;
    gridMetrics.gridWidth = rect.width;
    gridMetrics.gridHeight = rect.height;

    if (!didLoadLayout.value) {
      desktopLayout.value = loadDesktopLayout();
      fillMissingDesktopIconLayouts({ persist: true });
      didLoadLayout.value = true;
      return;
    }

    if (prevCols !== cols || prevRows !== rows) {
      fillMissingDesktopIconLayouts({ persist: true });
    }
  };

  const getDesktopItemStyle = (item) => {
    const key = getLayoutKey(item);
    const pos = key ? desktopLayout.value?.[key] : null;
    const idx = idxFromPos(pos);
    const cell = idx === null ? null : cellFromIdxOrNull(idx);
    const col = cell ? cell.col : 0;
    const row = cell ? cell.row : 0;
    return {
      transform: `translate3d(${col * gridMetrics.cellW}px, ${row * gridMetrics.cellH}px, 0)`,
      width: `${gridMetrics.cellW}px`,
      height: `${gridMetrics.cellH}px`,
    };
  };

  const computeGridDropIndex = (e) => {
    const rect = desktopGridRef?.value?.getBoundingClientRect?.();
    const localX = rect ? e.clientX - rect.left : 0;
    const localY = rect ? e.clientY - rect.top : 0;
    const dropCol = clampInt(localX / gridMetrics.cellW, 0, Math.max(0, gridMetrics.cols - 1));
    const dropRow = clampInt(localY / gridMetrics.cellH, 0, Math.max(0, gridMetrics.rows - 1));
    const dropIdx = (gridMetrics.cols - 1 - dropCol) * gridMetrics.rows + dropRow;
    return { dropCol, dropRow, dropIdx };
  };

  const buildOccupiedCells = ({ excludePaths } = {}) => {
    const occupied = new Set();
    occupyIconsCells(occupied, excludePaths instanceof Set ? excludePaths : new Set());
    return occupied;
  };

  const canPlaceIconPathsAtIndex = (paths, fromIdx, { excludePaths } = {}) => {
    const list = (paths || []).map((p) => String(p || '')).filter(Boolean);
    if (!list.length) return false;

    const occupied = buildOccupiedCells({ excludePaths });
    for (let i = 0; i < list.length; i++) {
      const cell = cellFromIdxOrNull(fromIdx + i);
      if (!cell) return false;
      if (occupied.has(cell.key)) return false;
      occupied.add(cell.key);
    }
    return true;
  };

  const resetDesktopLayout = () => {
    try {
      localStorage.removeItem(getCurrentLayoutKey());
    } catch {
      // ignore
    }

    desktopLayout.value = {};
    fillMissingDesktopIconLayouts({ persist: true });
  };

  onMounted(() => {
    const resizeObserver = new ResizeObserver(() => {
      updateGridMetrics();
    });
    if (desktopGridRef?.value) {
      resizeObserver.observe(desktopGridRef.value);
    }

    onUnmounted(() => {
      resizeObserver.disconnect();
    });
  });

  return {
    desktopLayout,
    gridMetrics,
    getLayoutKey,
    getDesktopItemStyle,
    loadDesktopLayout,
    saveDesktopLayout,
    fillMissingDesktopIconLayouts,
    updateGridMetrics,
    resetDesktopLayout,
    clampInt,
    computeGridDropIndex,
    cellFromIdxOrNull,
    buildOccupiedCells,
    canPlaceIconPathsAtIndex,
    isIconPosValid,
    occupyIconsCells,
  };
};
