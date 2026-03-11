const path = require('path');
const { getMounts } = require('../../../utils/db-utils');
const { SYSTEM_ROOT } = require('../../../config/constants');
const { normalizeApiPath, safeUserIdValue } = require('../../../utils/tooljs');

class MountManager {
    constructor(userId) {
        this.userId = safeUserIdValue(userId);
        this.userHome = path.join(SYSTEM_ROOT, String(this.userId));
        this.mounts = [];
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        const rows = await getMounts(this.userId);
        this.mounts = rows.map(m => ({
            ...m,
            mountPoint: normalizeApiPath(m.mountPoint)
        })).sort((a, b) => b.mountPoint.length - a.mountPoint.length);
        this.initialized = true;
    }

    findMount(apiPath) {
        const normalized = normalizeApiPath(apiPath);
        if (normalized === '/') {
            return {
                mount: this._createRootMount(),
                relativePath: '',
                isMountRoot: true
            };
        }

        const parts = normalized.slice(1).split('/').filter(Boolean);
        
        for (const mount of this.mounts) {
            const mp = mount.mountPoint;
            if (!mp || mp === '/') continue;

            const mountParts = mp.slice(1).split('/').filter(Boolean);
            if (parts.length < mountParts.length) continue;

            let match = true;
            for (let i = 0; i < mountParts.length; i++) {
                if (parts[i] !== mountParts[i]) {
                    match = false;
                    break;
                }
            }

            if (match) {
                const remaining = parts.slice(mountParts.length);
                return {
                    mount,
                    relativePath: remaining.join('/'),
                    isMountRoot: remaining.length === 0
                };
            }
        }

        return {
            mount: this._createRootMount(),
            relativePath: parts.join('/'),
            isMountRoot: parts.length === 0
        };
    }

    getMountsUnder(apiPath) {
        const normalized = normalizeApiPath(apiPath);
        const prefix = normalized === '/' ? '/' : `${normalized}/`;
        
        return this.mounts.filter(m => {
            const mp = m.mountPoint;
            return mp !== '/' && mp.startsWith(prefix);
        });
    }

    _createRootMount() {
        return {
            mountPoint: '/',
            localPath: this.userHome,
            type: 'local',
            config: '{}'
        };
    }
}

module.exports = MountManager;
