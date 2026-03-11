const path = require('path');
const crypto = require('crypto');
const { dbRun, dbGet, escapeSqliteLike } = require('../../utils/db-utils');
const { vfs } = require('../../services/vfs/ops');
const { ensure, createError } = require('../../utils/tooljs');

async function deleteFile(targetPath, userId) {
    ensure({ targetPath });
    const ctx = vfs.forUser(userId);
    const safeUserId = ctx.userId;

    // Use statPath to verify existence and get type, instead of resolveHandle which is internal
    try {
        await ctx.statPath(targetPath);
    } catch {
        throw createError('Target not found', 404);
    }
    
    // Normalize path via ctx
    const trashDir = '/.trash';
    const isInTrash = targetPath === trashDir || targetPath.startsWith(`${trashDir}/`);

    const cleanupPaths = new Set([targetPath]);

    if (safeUserId) {
        for (const p of cleanupPaths) {
            if (!p || p === '/') continue;
            const likePattern = `${escapeSqliteLike(p)}/%`;
            await dbRun("DELETE FROM favorites WHERE user_id = ? AND (path = ? OR path LIKE ? ESCAPE '\\')", [safeUserId, p, likePattern]);
            await dbRun("DELETE FROM share_links WHERE user_id = ? AND (file_path = ? OR file_path LIKE ? ESCAPE '\\')", [safeUserId, p, likePattern]);
        }
    }

    if (isInTrash) {
        const likePattern = `${escapeSqliteLike(targetPath)}/%`;
        await dbRun("DELETE FROM trash_items WHERE user_id = ? AND (trash_path = ? OR trash_path LIKE ? ESCAPE '\\')", [safeUserId, targetPath, likePattern]);
        await ctx.deletePath(targetPath);
        return { success: true, message: 'Deleted permanently' };
    }

    const baseName = path.posix.basename(targetPath);
    const trashItemPath = await ctx.findUniqueFilename(trashDir, baseName);
    
    await ctx.movePath(targetPath, trashItemPath);
    const id = crypto.randomUUID();
    await dbRun(
        "INSERT INTO trash_items (id, user_id, original_path, trash_path, deleted_at) VALUES (?, ?, ?, ?, ?)",
        [id, safeUserId, targetPath, trashItemPath, Date.now()]
    );
    return { success: true, message: 'Moved to trash' };
}

async function restoreFile(trashFilePath, userId) {
    ensure({ trashFilePath });
    const ctx = vfs.forUser(userId);
    const safeUserId = ctx.userId;

    const row = await dbGet(
        "SELECT id, original_path, trash_path FROM trash_items WHERE user_id = ? AND trash_path = ?",
        [safeUserId, trashFilePath]
    );
    if (!row) throw createError('Restore information missing', 404);

    const originalPath = row?.original_path;
    if (!originalPath) throw createError('Original location not found', 404);

    const parentPath = path.posix.dirname(originalPath);
    const filename = path.posix.basename(originalPath);

    await ctx.ensureDir(parentPath);

    let destPath = originalPath;
    if (await ctx.existsPath(destPath)) {
        const ext = path.posix.extname(filename);
        const base = path.posix.basename(filename, ext);
        destPath = path.posix.join(parentPath, `${base} (restored)${ext}`);
    }

    await ctx.movePath(trashFilePath, destPath);
    await dbRun("DELETE FROM trash_items WHERE id = ? AND user_id = ?", [row.id, safeUserId]);
    return { success: true, message: 'Restored successfully' };
}

module.exports = { deleteFile, restoreFile };
