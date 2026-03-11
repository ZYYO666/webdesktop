const BaseAdapter = require('./base-adapter');
const SMB2 = require('@marsaud/smb2');

class SMBAdapter extends BaseAdapter {
    constructor(config) {
        super(config);
        // config: { host, share, username, password, domain }
        
        let sharePath = config.share;
        // Construct UNC path if host is provided separately
        if (config.host && !sharePath.startsWith('\\\\')) {
             const host = config.host;
             // Remove leading slashes/backslashes from share name
             const shareName = config.share.replace(/^[\\/]+/, '');
             sharePath = `\\\\${host}\\${shareName}`;
        }

        this.client = new SMB2({
            share: sharePath,
            domain: config.domain || 'WORKGROUP',
            username: config.username,
            password: config.password
        });
    }

    _normalizePath(p) {
        // SMB2 expects paths without leading slash/backslash usually, 
        // or relative to share root.
        // Convert / to \
        let normalized = p.replace(/\//g, '\\');
        // Ensure no leading backslash unless it's root
        if (normalized.startsWith('\\')) {
            normalized = normalized.substring(1);
        }
        // If empty, it's root, keep it empty or specific representation?
        // SMB2 readdir('') works for root.
        return normalized || ''; 
    }

    async getStat(relativePath) {
        const path = this._normalizePath(relativePath);
        // Special case for root
        if (path === '') {
            return {
                size: 0,
                modified: new Date(),
                birthtime: new Date(),
                isDirectory: true
            };
        }

        const stat = await this.client.stat(path);
        return {
            size: stat.size,
            modified: stat.mtime,
            birthtime: stat.birthtime,
            isDirectory: stat.isDirectory(),
            mimeType: null
        };
    }

    async readdir(relativePath) {
        const path = this._normalizePath(relativePath);
        
        // Use stats: true to get file details efficiently
        const contents = await this.client.readdir(path, { stats: true });
        
        return contents
            .map(item => ({
                name: item.name,
                type: item.isDirectory() ? 'directory' : 'file',
                size: item.size,
                modified: item.mtime,
                isDirectory: item.isDirectory()
            }));
    }

    async readFile(relativePath) {
        const path = this._normalizePath(relativePath);
        return await this.client.readFile(path);
    }

    async writeFile(relativePath, content) {
        const path = this._normalizePath(relativePath);
        await this.client.writeFile(path, content);
    }

    async delete(relativePath) {
        const path = this._normalizePath(relativePath);
        // SMB2 has unlink for files and rmdir for directories
        // We need to know which one it is, or try both?
        // Usually we should check stat first.
        try {
            const stat = await this.client.stat(path);
            if (stat.isDirectory()) {
                await this.client.rmdir(path);
            } else {
                await this.client.unlink(path);
            }
        } catch (e) {
            // Try unlink directly if stat fails?
            await this.client.unlink(path);
        }
    }

    async mkdir(relativePath) {
        const path = this._normalizePath(relativePath);
        await this.client.mkdir(path);
    }

    async rename(oldPath, newPath) {
        const p1 = this._normalizePath(oldPath);
        const p2 = this._normalizePath(newPath);
        await this.client.rename(p1, p2);
    }
    
    // Copy not natively supported by all SMB clients simply, 
    // but we can implement read/write stream if needed, 
    // or use specific move command if available. 
    // BaseAdapter doesn't enforce copy, but FileService might not use it yet?
    // WebDAV has copy. SMB2 library might not have direct copy command exposed easily 
    // without reading/writing. 
    // Let's skip copy for now or implement via buffer if file is small.
}

module.exports = SMBAdapter;
