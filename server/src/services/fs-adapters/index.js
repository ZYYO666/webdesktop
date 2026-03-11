const LocalAdapter = require('./local-adapter');
const WebDAVAdapter = require('./webdav-adapter');
const SMBAdapter = require('./smb-adapter');
const BaseAdapter = require('./base-adapter');

const adapters = {};

/**
 * Register a new adapter type
 * @param {string} type - e.g., 's3', 'webdav'
 * @param {Class} adapterClass - Class extending BaseAdapter
 */
function registerAdapter(type, adapterClass) {
    adapters[type] = adapterClass;
}

registerAdapter('local', LocalAdapter);
registerAdapter('webdav', WebDAVAdapter);
registerAdapter('smb', SMBAdapter);

/**
 * Get adapter instance for a mount
 * @param {object} mount - Mount object from DB
 */
function getAdapter(mount) {
    if (!mount) return null;

    const type = mount.type || 'local';
    const AdapterClass = adapters[type];
    if (!AdapterClass) {
        throw new Error(`FileSystem adapter '${type}' not found`);
    }

    let config = {};
    try {
        config = typeof mount.config === 'string' ? JSON.parse(mount.config) : mount.config;
    } catch (e) {
        console.error('Invalid mount config:', e);
    }

    if (type === 'local') {
        config = { ...(config || {}), basePath: mount.localPath };
    }

    return new AdapterClass(config);
}

module.exports = {
    BaseAdapter,
    registerAdapter,
    getAdapter
};
