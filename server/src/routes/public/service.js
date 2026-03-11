const { dbAll } = require('../../utils/db-utils');
const { getFileContent } = require('../../services/file-service');
const { createError } = require('../../utils/tooljs');

/**
 * 获取分享文件内容
 * @param {string} shareId 
 * @returns {Promise<{buffer: Buffer, mimeType: string, name: string}>}
 */
async function getSharedFile(shareId) {
    if (!/^[a-f0-9]{12}$/i.test(String(shareId || ''))) {
        throw createError('Invalid share ID', 400);
    }

    const rows = await dbAll('SELECT * FROM share_links WHERE id = ?', [shareId]);
    const row = rows[0];

    if (!row) {
        throw createError('Link not found or expired', 404);
    }

    const { buffer, mimeType, name } = await getFileContent(row.file_path, row.user_id);
    
    // 异步更新下载计数，不阻塞主流程
    dbAll('UPDATE share_links SET downloads = downloads + 1 WHERE id = ?', [shareId]).catch(console.error);

    return { buffer, mimeType, name };
}

module.exports = {
    getSharedFile
};
