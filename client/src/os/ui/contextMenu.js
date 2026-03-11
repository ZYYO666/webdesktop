import { reactive, shallowRef } from 'vue';

export const createContextMenu = () => {
  const state = reactive({
    visible: false,
    position: { top: 0, left: 0 },
    context: null
  });

  const openedAt = shallowRef(0);

  const open = (ctx = {}) => {
    const e = ctx.event;
    const pos = ctx.position || (e ? { top: e.clientY, left: e.clientX } : null) || { top: 0, left: 0 };
    openedAt.value = Date.now();
    state.position.top = Number.isFinite(pos.top) ? pos.top : 0;
    state.position.left = Number.isFinite(pos.left) ? pos.left : 0;
    state.context = ctx;
    state.visible = true;
  };

  const close = () => {
    if (Date.now() - openedAt.value < 350) return;
    state.visible = false;
    state.context = null;
  };

  const select = async (key) => {
    const ctx = state.context || {};
    state.visible = false;
    state.context = null;

    if (typeof key === 'string' && key.startsWith('sort:')) {
      const sortKey = key.split(':')[1];
      const sortHandler = ctx.onSort || ctx.handlers?.sort;
      if (typeof sortHandler === 'function') {
        await sortHandler(sortKey, ctx);
      }
      return;
    }

    const handlers = ctx.handlers && typeof ctx.handlers === 'object' ? ctx.handlers : null;
    const handler = handlers ? handlers[key] : null;
    if (typeof handler === 'function') {
      await handler(ctx, key);
      return;
    }

    if (typeof ctx.onSelect === 'function') {
      await ctx.onSelect(key, ctx);
      return;
    }
  };

  return { state, open, close, select };
};

