const MountManager = require('./mount-manager');
const { VfsContext } = require('./context');
const { ensureUserWorkspace } = require('../utils/workspace');
const { normalizeApiPath } = require('../utils/path');
const { safeUserIdValue } = require('../utils/user-id');
const path = require('path');
const crypto = require('crypto');

class VfsManager {
    constructor() {
        this.contexts = new Map();
    }

    forUser(userId) {
        const safeId = safeUserIdValue(userId);
        
        // Contexts are lightweight but MountManager has state (cache).
        // In a stateless HTTP request model, we usually create fresh instances per request,
        // or cache them carefully. For now, let's create fresh to ensure mount updates are reflected.
        // Optimization: Could cache MountManager with a TTL or invalidation.
        
        const mountManager = new MountManager(safeId);
        const ctx = new VfsContext(safeId, mountManager);

        const proxy = this._createProxy(ctx);
        
        // Ensure workspace on init (async, non-blocking)
        // Note: This is a side effect. In a strictly pure design, this might be explicit.
        // But for DX, ensuring workspace existence when obtaining VFS context is convenient.
        // We catch errors to avoid crashing the request if workspace creation fails (e.g. permission)
        ensureUserWorkspace(safeId).catch(err => {
             console.error(`[VFS] Failed to ensure workspace for user ${safeId}:`, err.message);
        });

        return proxy;
    }

    _createProxy(ctx) {
        // Expose the fluent API expected by the application
        return {
            userId: ctx.userId,
            path: {
                normalize: normalizeApiPath,
                basename: (p) => path.posix.basename(normalizeApiPath(p)),
                dirname: (p) => path.posix.dirname(normalizeApiPath(p)),
                join: (...args) => normalizeApiPath(path.posix.join(...args.map(a => String(a||'')))),
                child: (base, name) => normalizeApiPath(path.posix.join(normalizeApiPath(base), String(name||'')))
            },
            
            resolve: (p) => ctx.resolve(p),
            statPath: (p) => this._statPath(ctx, p),
            statType: (p, type) => this._statType(ctx, p, type),
            listDir: (p) => this._listDir(ctx, p),
            readFile: (p) => this._readFile(ctx, p),
            writeFile: (p, c) => this._writeFile(ctx, p, c),
            mkdir: (p) => this._mkdir(ctx, p),
            ensureDir: (p) => this._ensureDir(ctx, p),
            deletePath: (p) => this._deletePath(ctx, p),
            findUniqueFilename: (d, b) => this._findUniqueFilename(ctx, d, b),
            search: (q, r, opts) => this._search(ctx, q, r, opts),
            renamePath: (oldP, newP) => this._renamePath(ctx, oldP, newP),
            copyPath: (oldP, newP) => this._copyPath(ctx, oldP, newP),
            movePath: (oldP, newP) => this._renamePath(ctx, oldP, newP),
            existsPath: (p) => this._existsPath(ctx, p)
        };
    }

    async _statType(ctx, vfsPath, type) {
        try {
            const res = await this._statPath(ctx, vfsPath);
            if (type === 'directory' && !res.stat.isDirectory) {
                throw new Error('Path is not a directory');
            }
            if (type === 'file' && res.stat.isDirectory) {
                throw new Error('Path is a directory');
            }
            return res;
        } catch (err) {
            if (err.message === 'INVALID_PATH') throw err;
            if (err.message === 'Path not found' || err.code === 'ENOENT') {
                throw new Error('Path not found');
            }
            throw err;
        }
    }

    async _statPath(ctx, vfsPath) {
        const { node, normalizedPath } = await ctx.resolve(vfsPath);
        const stat = await node.adapter.getStat(node.relativePath);
        return {
            path: normalizedPath,
            stat,
            isMountRoot: node.isMountRoot,
            cacheKey: `${node.storageSignature}|${node.relativePath}`
        };
    }

    async _existsPath(ctx, vfsPath) {
        try {
            await this._statPath(ctx, vfsPath);
            return true;
        } catch {
            return false;
        }
    }

    async _listDir(ctx, vfsPath) {
        const { node, normalizedPath } = await ctx.resolve(vfsPath);
        
        // 1. Get physical files
        let children = [];
        try {
            children = await node.adapter.readdir(node.relativePath);
        } catch (err) {
            // It's okay if physical dir doesn't exist but we have virtual children
            children = [];
        }

        // 2. Normalize children
        const entries = children.map(c => ({
            name: c.name,
            type: c.isDirectory ? 'directory' : 'file',
            size: c.size || 0,
            modified: c.modified || new Date(),
            birthtime: c.birthtime || new Date(),
            isDirectory: !!c.isDirectory,
            isMount: false
        }));

        // 3. Inject virtual mounts
        const virtuals = ctx.mountManager.getMountsUnder(normalizedPath);
        const seen = new Set(entries.map(e => e.name));

        for (const vm of virtuals) {
            const rel = vm.mountPoint.slice(normalizedPath === '/' ? 1 : normalizedPath.length + 1);
            const name = rel.split('/')[0];
            if (!name) continue;

            if (!seen.has(name)) {
                entries.push({
                    name,
                    type: 'directory',
                    size: 0,
                    modified: new Date(),
                    birthtime: new Date(),
                    isDirectory: true,
                    isMount: true
                });
                seen.add(name);
            }
        }

        if (entries.length === 0 && children.length === 0 && virtuals.length === 0) {
             // If we failed to read physical dir AND have no virtuals, rethrow the original error if any,
             // or check if directory exists at all.
             // For now, let's try to verify if directory exists if it's not a root
             if (!node.isMountRoot) {
                 await node.adapter.getStat(node.relativePath);
             }
        }

        return { path: normalizedPath, children: entries };
    }

    async _readFile(ctx, vfsPath) {
        const { node, normalizedPath } = await ctx.resolve(vfsPath);
        const buf = await node.adapter.readFile(node.relativePath);
        return {
            path: normalizedPath,
            buffer: Buffer.isBuffer(buf) ? buf : Buffer.from(buf)
        };
    }

    async _writeFile(ctx, vfsPath, content) {
        const { node } = await ctx.resolve(vfsPath);
        await node.adapter.writeFile(node.relativePath, content);
    }

    async _mkdir(ctx, vfsPath) {
        const { node } = await ctx.resolve(vfsPath);
        await node.adapter.mkdir(node.relativePath);
    }

    async _ensureDir(ctx, vfsPath) {
        const normalized = normalizeApiPath(vfsPath);
        if (normalized === '/') return; // Root always exists

        try {
            const { stat } = await this._statPath(ctx, normalized);
            if (!stat.isDirectory) throw new Error('Path exists but is not a directory');
            return;
        } catch (err) {
            if (err.message !== 'Path not found' && err.code !== 'ENOENT') throw err;
        }

        // Parent must exist or be created recursively
        const parent = path.posix.dirname(normalized);
        await this._ensureDir(ctx, parent);

        // Now create current
        try {
            await this._mkdir(ctx, normalized);
        } catch (err) {
            // Race condition check
            try {
                const { stat } = await this._statPath(ctx, normalized);
                if (stat.isDirectory) return;
            } catch { /* ignore */ }
            throw err;
        }
    }

    async _findUniqueFilename(ctx, dir, baseName) {
        const name = String(baseName || '').trim();
        const joinPath = (...args) => normalizeApiPath(path.posix.join(...args.map(a => String(a||''))));

        if (!name) return joinPath(dir, crypto.randomUUID());

        const ext = path.posix.extname(name);
        const base = ext ? name.slice(0, -ext.length) : name;
        const first = joinPath(dir, name);

        if (!await this._existsPath(ctx, first)) return first;

        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        
        // Try up to 1000 suffix combinations
        for (let i = 1; i < 1000; i++) {
            const suffix = i === 1 ? ` (deleted ${ts})` : ` (deleted ${ts}) ${i}`;
            const candidate = joinPath(dir, `${base}${suffix}${ext}`);
            if (!await this._existsPath(ctx, candidate)) return candidate;
        }

        // Fallback to timestamp
        return joinPath(dir, `${base} (deleted ${Date.now()})${ext}`);
    }

    async _search(ctx, query, rootPath, options = {}) {
        const normalizedQuery = String(query || '').toLowerCase();
        if (!normalizedQuery) return [];

        const maxResults = options.maxResults || 1000;
        const skipDirs = new Set(options.skipDirs || ['node_modules', '.git', '.trash']);
        const results = [];

        const searchRecursive = async (currentPath) => {
            if (results.length >= maxResults) return;

            let listed;
            try {
                listed = await this._listDir(ctx, currentPath);
            } catch (err) {
                // Ignore directory access errors (permission, not found) during recursion
                // to allow partial results from other directories
                return;
            }
            
            const baseApi = listed.path;

            for (const child of listed.children || []) {
                if (results.length >= maxResults) return;

                const name = child.name;
                const childPath = normalizeApiPath(path.posix.join(baseApi, name));
                const lower = name.toLowerCase();

                if (lower.includes(normalizedQuery)) {
                    results.push({
                        path: childPath,
                        name,
                        type: child.type,
                        size: child.size,
                        modified: child.modified
                    });
                }

                if (child.isDirectory && !skipDirs.has(name)) {
                    await searchRecursive(childPath);
                }
            }
        };

        await searchRecursive(rootPath || '/');
        
        return results;
    }

    async _deletePath(ctx, vfsPath) {
        const { node } = await ctx.resolve(vfsPath);
        if (node.isMountRoot) {
            throw new Error('Cannot delete mount root directly. Unmount instead.');
        }

        // Recursive delete helper if adapter doesn't support it natively
        // Most adapters (like local fs-extra) support recursive delete, 
        // but let's assume standard interface is simple delete.
        // Actually fs-extra remove is recursive. 
        // If we need to enforce safe recursive delete across generic adapters:
        
        await node.adapter.delete(node.relativePath);
    }

    async _renamePath(ctx, oldPath, newPath) {
        const src = await ctx.resolve(oldPath);
        const dst = await ctx.resolve(newPath);

        if (src.node.isMountRoot) {
            throw new Error('Cannot move mount root directly.');
        }

        // Check if source contains mounts
        const mountsUnder = ctx.mountManager.getMountsUnder(src.normalizedPath);
        if (mountsUnder.length > 0) {
            throw new Error('Cannot move a directory containing mount points.');
        }

        if (src.node.storageSignature === dst.node.storageSignature) {
            await src.node.adapter.rename(src.node.relativePath, dst.node.relativePath);
            return;
        }

        // Cross-mount move = Copy + Delete
        await this._copyPathInternal(src.node, dst.node);
        await src.node.adapter.delete(src.node.relativePath);
    }

    async _copyPath(ctx, oldPath, newPath) {
        const src = await ctx.resolve(oldPath);
        const dst = await ctx.resolve(newPath);
        await this._copyPathInternal(src.node, dst.node);
    }

    async _copyPathInternal(srcNode, dstNode) {
        // 1. Try native copy if same mount
        if (srcNode.storageSignature === dstNode.storageSignature) {
            try {
                await dstNode.adapter.copy(srcNode.relativePath, dstNode.relativePath);
                return;
            } catch (err) {
                // Fallback
            }
        }

        // 2. Check if directory
        const stat = await srcNode.adapter.getStat(srcNode.relativePath);
        if (stat.isDirectory) {
            // Recursive copy
            await dstNode.adapter.mkdir(dstNode.relativePath);
            
            const children = await srcNode.adapter.readdir(srcNode.relativePath);
            for (const child of children) {
                const childSrcRel = path.posix.join(srcNode.relativePath, child.name);
                const childDstRel = path.posix.join(dstNode.relativePath, child.name);
                
                // Construct temporary nodes for children to reuse logic
                // Note: We know they are on the same mount, so we can reuse the mount/adapter
                const childSrcNode = new (require('./context').FileSystemNode)(srcNode.mount, childSrcRel, false);
                const childDstNode = new (require('./context').FileSystemNode)(dstNode.mount, childDstRel, false);
                
                await this._copyPathInternal(childSrcNode, childDstNode);
            }
        } else {
            // File copy via stream/buffer
            const buf = await srcNode.adapter.readFile(srcNode.relativePath);
            await dstNode.adapter.writeFile(dstNode.relativePath, buf);
        }
    }
}

module.exports = new VfsManager();
