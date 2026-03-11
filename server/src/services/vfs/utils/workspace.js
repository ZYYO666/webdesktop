const fs = require('fs-extra');
const path = require('path');
const { SYSTEM_ROOT } = require('../../../config/constants');
const { safeUserIdValue, safeUserIdString } = require('./user-id');

async function ensureUserWorkspace(userId) {
    const safeUserId = safeUserIdValue(userId);
    const safeIdStr = safeUserIdString(safeUserId);
    const userHome = path.join(SYSTEM_ROOT, safeIdStr);

    await fs.ensureDir(userHome);
    await Promise.all([
        fs.ensureDir(path.join(userHome, 'desktop')),
        fs.ensureDir(path.join(userHome, 'photos')),
        fs.ensureDir(path.join(userHome, 'documents')),
        fs.ensureDir(path.join(userHome, 'downloads')),
        fs.ensureDir(path.join(userHome, '.trash'))
    ]);

    return { userHome, userId: safeUserId };
}

module.exports = { ensureUserWorkspace };
