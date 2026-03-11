const vfsManager = require('./core/vfs-manager');

const vfs = {
    forUser(userId = 0) {
        return vfsManager.forUser(userId);
    }
};

module.exports = {
    vfs
};
