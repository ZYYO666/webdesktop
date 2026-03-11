import { toAppKey } from '../utils/index';

const modules = import.meta.glob('../../apps/*/index.js', { eager: true });
const DEFAULT_ICON = '/LaunchNext.png';

export const APPS = Object.entries(modules)
  .map(([, mod]) => mod?.default)
  .filter((app) => app && app.id)
  .reduce((acc, app) => {
    const key = toAppKey(app.id);
    if (!key) return acc;
    if (acc[key]) return acc;

    if (!app.iconImage) {
      app.iconImage = DEFAULT_ICON;
    }

    acc[key] = app;
    return acc;
  }, {});
