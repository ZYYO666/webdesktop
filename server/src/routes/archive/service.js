const path = require('path');
const archiver = require('archiver');
const { Writable } = require('stream');
const { vfs } = require('../../services/vfs/ops');
const { normalizeApiPath, isTrashPath } = require('../../services/vfs/utils/path');
const { ensure } = require('../../utils/tooljs');

async function compressFiles(files, archiveName, parentPath, userId) {
    const ctx = vfs.forUser(userId);

    // Validation
    ensure({ files, archiveName, parentPath });

    const base = normalizeApiPath(parentPath ?? '/');
    const archiveApiPath = path.posix.join(base, archiveName);
    const archiveParent = path.posix.dirname(archiveApiPath);

    // VFS abstractions for validation
    await ctx.statType(archiveParent, 'directory');

    if (await ctx.existsPath(archiveApiPath)) {
        throw new Error('Archive already exists');
    }

    const chunks = [];
    const output = new Writable({
        write(chunk, _enc, cb) {
            chunks.push(Buffer.from(chunk));
            cb();
        }
    });

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('warning', () => { /* ignore */ });

    const done = new Promise((resolve, reject) => {
        output.on('finish', resolve);
        output.on('error', reject);
        archive.on('error', reject);
    });

    archive.pipe(output);

    const addFile = async (apiPath, nameInArchive) => {
        const { stat } = await ctx.statPath(apiPath);
        if (stat.isDirectory) {
            const listed = await ctx.listDir(apiPath);
            const baseApi = String(listed?.path || '/');
            for (const child of listed.children || []) {
                const childName = String(child.name || '');
                if (!childName) continue;
                const childApi = ctx.path.child(baseApi, childName);
                const childNameInArchive = `${nameInArchive}/${childName}`;
                await addFile(childApi, childNameInArchive);
            }
            return;
        }

        const { buffer } = await ctx.readFile(apiPath);
        archive.append(buffer, { name: nameInArchive });
    };

    for (const apiPathRaw of files) {
        const nameInArchive = ctx.path.basename(apiPathRaw);
        await addFile(apiPathRaw, nameInArchive);
    }

    await archive.finalize();
    await done;

    const zipBuffer = Buffer.concat(chunks);
    await ctx.writeFile(archiveApiPath, zipBuffer);
    return { success: true, size: zipBuffer.length };
}

async function extractArchive(filePath, destination, userId) {
    ensure({ filePath });
    const ctx = vfs.forUser(userId);

    const { stat, path: normalizedFilePath } = await ctx.statPath(filePath);
    if (stat.isDirectory) throw new Error('Path is a directory');

    const baseDir = path.posix.dirname(normalizedFilePath);
    const ext = path.posix.extname(normalizedFilePath);
    const baseName = path.posix.basename(normalizedFilePath, ext);

    const destBase = destination ? normalizeApiPath(destination) : normalizeApiPath(path.posix.join(baseDir, baseName));
    
    if (isTrashPath(destBase)) {
        throw new Error('禁止操作回收站目录');
    }

    await ctx.ensureDir(destBase);

    const { buffer } = await ctx.readFile(normalizedFilePath);
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(buffer);

    const safeEntryPath = (entryName) => {
        let p = String(entryName || '').replace(/\\/g, '/');
        p = p.replace(/^\/+/, '');
        p = path.posix.normalize(p);
        if (!p || p === '.' || p.startsWith('..') || p.includes('../')) return null;
        return p;
    };

    for (const entry of zip.getEntries()) {
        const rel = safeEntryPath(entry.entryName);
        if (!rel) continue;

        const outPath = path.posix.join(destBase, rel);
        if (entry.isDirectory) {
            await ctx.ensureDir(outPath);
            continue;
        }

        const parent = path.posix.dirname(outPath);
        await ctx.ensureDir(parent);
        const data = entry.getData();
        await ctx.writeFile(outPath, data);
    }

    return { success: true, message: 'Extraction complete' };
}

module.exports = { compressFiles, extractArchive };
