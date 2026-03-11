const { vfs } = require('../../services/vfs/ops');
const { ensure } = require('../../utils/tooljs');

async function searchFiles(query, rootPath, userId) {
    ensure({ query });
    const ctx = vfs.forUser(userId);
    return ctx.search(query, rootPath || '/');
}

module.exports = { searchFiles };
