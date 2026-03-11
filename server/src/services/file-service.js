const fs = require('fs-extra');
const path = require('path');
const { getSetting, dbAll } = require('../utils/db-utils');
const { CACHE_DIR } = require('../config/constants');
const { getLowercaseExtension, inferMimeTypeFromExtension } = require('./vfs/utils/file-type');
const { isTrashPath } = require('./vfs/utils/path');
const { vfs } = require('./vfs/ops');
const { ensure, createError } = require('../utils/tooljs');

const publicVfs = vfs.forUser(0);

async function getFileStats(filePath, userId) {
    ensure({ filePath });

    const ctx = vfs.forUser(userId);
    const { stat, path: normalizedPath } = await ctx.statPath(filePath);

    const ext = getLowercaseExtension(normalizedPath);
    const type = stat.isDirectory ? 'directory' : 'file';
    const mimeType = stat.isDirectory ? 'inode/directory' : inferMimeTypeFromExtension(ext);

    return {
        name: path.posix.basename(normalizedPath),
        path: normalizedPath,
        size: stat.size || 0,
        type: type,
        mimeType: mimeType,
        extension: path.posix.extname(normalizedPath).toLowerCase(),
        birthtime: stat.birthtime || new Date(),
        created: stat.birthtime || new Date(),
        modified: stat.modified || new Date(),
        accessed: stat.accessed || new Date(),
        permissions: '755'
    };
}

async function listFiles(reqPath, userId) {
    const ctx = vfs.forUser(userId);
    const safeUserId = ctx.userId;

    let children = [];
    let normalizedReqPath = '/';
    try {
        const listed = await ctx.listDir(reqPath || '/');
        normalizedReqPath = String(listed?.path || '/');
        children = listed.children || [];
    } catch (err) {
        if (err && err.message === 'INVALID_PATH') throw createError('Invalid path', 400);
        throw createError('Directory not found', 404);
    }

    const showDotfiles = await getSetting('showDotfiles', 'false');
    const isShowDotfiles = showDotfiles === 'true' || showDotfiles === true;

    let favSet = new Set();
    if (safeUserId) {
        const rows = await dbAll('SELECT path FROM favorites WHERE user_id = ?', [safeUserId]).catch(() => []);
        favSet = new Set((rows || []).map((r) => r.path));
    }

    const files = (children || []).reduce((acc, f) => {
        const name = String(f.name || '');
        if (!name) return acc;
        if (!isShowDotfiles && name.startsWith('.')) return acc;

        const childApiPath = normalizedReqPath === '/' ? `/${name}` : `${normalizedReqPath}/${name}`;
        
        acc.push({
            path: childApiPath,
            name: name,
            type: f.isDirectory ? 'directory' : 'file',
            size: f.isDirectory ? 0 : (f.size || 0),
            birthtime: f.birthtime || new Date(),
            modified: f.modified || new Date(),
            isFavorite: favSet.has(childApiPath)
        });
        return acc;
    }, []);

    files.sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
    });

    return {
        path: normalizedReqPath,
        files
    };
}

async function getFileContent(filePath, userId) {
    ensure({ filePath });
    // Remove trash check to allow reading/previewing files in trash
    // if (isTrashPath(filePath)) throw createError('禁止操作回收站目录', 403);

    const ctx = vfs.forUser(userId);

    const { path: normalizedPath } = await ctx.statType(filePath, 'file');
    
    const { buffer } = await ctx.readFile(normalizedPath);
    const ext = getLowercaseExtension(normalizedPath);
    const mimeType = inferMimeTypeFromExtension(ext);
    return { buffer, mimeType, name: path.posix.basename(normalizedPath) };
}

async function createDirectory(parentPath, name, userId) {
    ensure({ name });

    const ctx = vfs.forUser(userId);
    const target = ctx.path.join(parentPath || '/', name);
    
    if (isTrashPath(parentPath) || isTrashPath(target)) {
        throw createError('禁止操作回收站目录', 403);
    }

    await ctx.mkdir(target);
    return { success: true, message: 'Folder created' };
}

async function saveFile(filePath, content, userId) {
    ensure({ filePath });
    if (content === undefined) throw createError('Content required', 400);

    if (isTrashPath(filePath)) throw createError('禁止操作回收站目录', 403);

    const ctx = vfs.forUser(userId);
    await ctx.writeFile(filePath, content);
    return { success: true, message: 'File saved successfully' };
}

async function renameFile(oldPath, newName, userId) {
    ensure({ oldPath, newName });
    if (isTrashPath(oldPath)) throw createError('禁止操作回收站目录', 403);

    const ctx = vfs.forUser(userId);
    // Ensure source exists and is valid (not checking type strictly, but it must exist)
    await ctx.statPath(oldPath);
    
    const dir = path.posix.dirname(oldPath);
    const newPath = ctx.path.join(dir, newName);

    if (await ctx.existsPath(newPath)) {
        throw createError('File exists', 409);
    }

    await ctx.renamePath(oldPath, newPath);
    return { success: true, message: 'Renamed successfully' };
}

async function moveFile(oldPath, newPath, userId) {
    ensure({ oldPath, newPath });

    if (isTrashPath(oldPath) || isTrashPath(newPath)) throw createError('禁止操作回收站目录', 403);

    const ctx = vfs.forUser(userId);
    let normalizedOld;
    try {
        ({ path: normalizedOld } = await ctx.statPath(oldPath));
    } catch {
        throw createError('Source not found', 404);
    }

    const destDir = path.posix.dirname(newPath) || '/';
    if (!await ctx.existsPath(destDir)) {
        throw createError('Destination directory not found', 404);
    }

    if (await ctx.existsPath(newPath)) {
        throw createError('File exists in destination', 409);
    }

    await ctx.movePath(normalizedOld, newPath);
    return { success: true, message: 'Moved successfully' };
}

async function copyFile(oldPath, newPath, userId) {
    ensure({ oldPath, newPath });

    if (isTrashPath(oldPath) || isTrashPath(newPath)) throw createError('禁止操作回收站目录', 403);

    const ctx = vfs.forUser(userId);
    let normalizedOld;
    try {
        ({ path: normalizedOld } = await ctx.statPath(oldPath));
    } catch {
        throw createError('Source not found', 404);
    }

    const destDir = path.posix.dirname(newPath) || '/';
    if (!await ctx.existsPath(destDir)) {
        throw createError('Destination directory not found', 404);
    }

    if (await ctx.existsPath(newPath)) {
        throw createError('File exists in destination', 409);
    }

    await ctx.copyPath(normalizedOld, newPath);
    return { success: true, message: 'Copied successfully' };
}

async function clearCache() {
    await fs.emptyDir(CACHE_DIR);
    return { success: true, message: 'Cache cleared successfully' };
}

module.exports = {
    normalizePath: (p) => publicVfs.path.normalize(p || '/'),
    getPathBasename: (p) => publicVfs.path.basename(p || '/'),
    getFileStats,
    listFiles,
    getFileContent,
    createDirectory,
    saveFile,
    renameFile,
    moveFile,
    copyFile,
    clearCache
};
