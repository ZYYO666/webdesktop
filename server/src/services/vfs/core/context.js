const { getAdapter } = require('../../fs-adapters');
const { normalizeApiPath } = require('../utils/path');

class FileSystemNode {
    constructor(mount, relativePath, isMountRoot) {
        this.mount = mount;
        this.relativePath = relativePath;
        this.isMountRoot = isMountRoot;
        this.adapter = getAdapter(mount);
        
        if (!this.adapter) {
            throw new Error(`Unsupported mount type: ${mount.type}`);
        }
    }

    get storageSignature() {
        return [
            String(this.mount.type || ''),
            String(this.mount.localPath || ''),
            typeof this.mount.config === 'string' ? this.mount.config : JSON.stringify(this.mount.config || {})
        ].join('|');
    }
}

class VfsContext {
    constructor(userId, mountManager) {
        this.userId = userId;
        this.mountManager = mountManager;
    }

    async resolve(vfsPath) {
        await this.mountManager.init();
        
        const raw = String(vfsPath ?? '').replace(/\\/g, '/');
        if (raw.split('/').filter(Boolean).includes('..')) {
            throw new Error('INVALID_PATH');
        }

        const normalized = normalizeApiPath(raw);
        if (normalized === '/..' || normalized.startsWith('/../')) {
            throw new Error('INVALID_PATH');
        }

        const result = this.mountManager.findMount(normalized);
        return {
            node: new FileSystemNode(result.mount, result.relativePath, result.isMountRoot),
            mounts: this.mountManager.mounts,
            normalizedPath: normalized
        };
    }
}

module.exports = { VfsContext, FileSystemNode };
