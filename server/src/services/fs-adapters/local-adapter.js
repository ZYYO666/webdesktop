const fs = require('fs-extra');
const path = require('path');
const BaseAdapter = require('./base-adapter');
const { isWithinPath, normalizeApiPath } = require('../vfs/utils/path');

function normalizeRelativePath(input) {
  const raw = String(input ?? '').replace(/\\/g, '/');
  if (!raw || raw === '/') return '';
  // Use shared normalization but strip leading slash for relative path
  const normalized = normalizeApiPath(raw);
  return normalized === '/' ? '' : normalized.slice(1);
}

class LocalAdapter extends BaseAdapter {
  constructor(mountConfig) {
    super(mountConfig);
    this.basePath = path.resolve(String(mountConfig?.basePath ?? ''));
    if (!this.basePath) throw new Error('Invalid mount basePath');
    this._baseRealPathPromise = null;
  }

  async _getBaseRealPath() {
    if (!this._baseRealPathPromise) {
      this._baseRealPathPromise = fs.realpath(this.basePath).catch(() => this.basePath);
    }
    return this._baseRealPathPromise;
  }

  async getFullPath(vfsPath) {
    const rel = normalizeRelativePath(vfsPath);
    // Securely join path: base + relative
    const candidate = path.resolve(path.join(this.basePath, rel));
    
    // First check: lexical containment
    if (!isWithinPath(this.basePath, candidate)) throw new Error('INVALID_PATH');

    // Optimization: Avoid realpath if not necessary for security (e.g. strict mode)
    // But for safety against symlink attacks, we should verify the real path matches base
    
    try {
      const real = await fs.realpath(candidate);
      const baseReal = await this._getBaseRealPath();
      if (!isWithinPath(baseReal, real)) throw new Error('INVALID_PATH');
      return candidate; // Return the resolved path or candidate? Usually candidate is preferred for stability unless symlink
    } catch (err) {
        if (err.code === 'ENOENT') {
            // File doesn't exist, so we can't realpath it. 
            // We check the parent directory instead to ensure we are creating it in a safe place.
            const parent = path.dirname(candidate);
            const parentReal = await fs.realpath(parent).catch(() => parent);
            const baseReal = await this._getBaseRealPath();
            if (!isWithinPath(baseReal, parentReal)) throw new Error('INVALID_PATH');
            return candidate;
        }
        throw err;
    }
  }

  async getStat(vfsPath) {
    const fullPath = await this.getFullPath(vfsPath);
    const stat = await fs.stat(fullPath);
    return {
      size: stat.size,
      modified: stat.mtime,
      birthtime: stat.birthtime,
      isDirectory: stat.isDirectory(),
      mimeType: null
    };
  }

  async readdir(vfsPath) {
    const fullPath = await this.getFullPath(vfsPath);
    const dirents = await fs.readdir(fullPath, { withFileTypes: true });

    // Optimization: Use Promise.all with map for concurrent processing
    const items = await Promise.all(dirents.map(async (dirent) => {
      let stat = null;
      // Only stat if we need exact size/time for files. For directories it's often 0/irrelevant in listings.
      // But frontend might expect dates.
      // We can optimistically skip stat for directories or if performance is key.
      // For now, let's keep it but make it robust.
      
      try {
        const childFullPath = path.join(fullPath, dirent.name);
        stat = await fs.stat(childFullPath);
      } catch {
        // Ignore stat errors (e.g. broken links, permission denied during race)
      }

      return {
        name: dirent.name,
        type: dirent.isDirectory() ? 'directory' : 'file',
        size: stat ? stat.size : 0,
        modified: stat ? stat.mtime : new Date(),
        birthtime: stat ? stat.birthtime : new Date(),
        isDirectory: dirent.isDirectory()
      };
    }));

    return items;
  }

  async readFile(vfsPath) {
    const fullPath = await this.getFullPath(vfsPath);
    return fs.readFile(fullPath);
  }

  async writeFile(vfsPath, content) {
    const fullPath = await this.getFullPath(vfsPath);
    const parent = path.dirname(fullPath);
    if (!await fs.pathExists(parent)) throw new Error('Parent directory not found');
    if (Buffer.isBuffer(content)) {
      await fs.writeFile(fullPath, content);
      return;
    }
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  async delete(vfsPath) {
    const fullPath = await this.getFullPath(vfsPath);
    await fs.remove(fullPath);
  }

  async mkdir(vfsPath) {
    const fullPath = await this.getFullPath(vfsPath);
    if (await fs.pathExists(fullPath)) throw new Error('Folder already exists');
    await fs.ensureDir(fullPath);
  }

  async rename(oldVfsPath, newVfsPath) {
    const src = await this.getFullPath(oldVfsPath);
    const dst = await this.getFullPath(newVfsPath);
    if (await fs.pathExists(dst)) throw new Error('File exists');
    await fs.move(src, dst);
  }

  async copy(sourceVfsPath, destVfsPath) {
    const src = await this.getFullPath(sourceVfsPath);
    const dst = await this.getFullPath(destVfsPath);
    if (await fs.pathExists(dst)) throw new Error('File exists');
    await fs.copy(src, dst);
  }
}

module.exports = LocalAdapter;
