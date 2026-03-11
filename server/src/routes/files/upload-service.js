const path = require('path');
const { vfs } = require('../../services/vfs/ops');
const { isTrashPath } = require('../../services/vfs/utils/path');
const { ensure, createError } = require('../../utils/tooljs');

async function uploadFile(destDir, file, userId) {
    ensure({ file });
    
    const ctx = vfs.forUser(userId);

    if (isTrashPath(destDir)) throw createError('禁止操作回收站目录', 403);

    const rawOriginalname = String(file?.originalname || '').trim();
    let filename = rawOriginalname;
    try {
        filename = Buffer.from(rawOriginalname, 'latin1').toString('utf8');
    } catch {
        // ignore encoding errors
    }
    filename = filename.replace(/\\/g, '/');
    filename = path.posix.basename(filename);
    
    ensure({ filename });
    
    const buffer = file?.buffer;
    if (!buffer || !Buffer.isBuffer(buffer)) throw createError('File buffer required', 400);

    // VFS handles validation and normalization now
    const { path: normalizedDir } = await ctx.statType(destDir || '/', 'directory');

    const target = ctx.path.child(normalizedDir, filename);
    await ctx.writeFile(target, buffer);
    return { success: true, message: 'File uploaded successfully' };
}

module.exports = { uploadFile };
