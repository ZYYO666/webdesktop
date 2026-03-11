const BaseAdapter = require('./base-adapter');
const { createClient } = require('webdav');

class WebDAVAdapter extends BaseAdapter {
    constructor(config) {
        super(config);
        // config: { url, username, password }
        this.client = createClient(config.url, {
            username: config.username,
            password: config.password
        });
    }

    _normalizePath(p) {
        // WebDAV usually expects paths starting with /
        return p.startsWith('/') ? p : '/' + p;
    }

    async getStat(relativePath) {
        try {
            const stat = await this.client.stat(this._normalizePath(relativePath));
            return {
                size: stat.size,
                modified: new Date(stat.lastmod),
                birthtime: new Date(stat.lastmod), // WebDAV typically doesn't give birthtime
                isDirectory: stat.type === 'directory',
                mimeType: stat.mime
            };
        } catch (error) {
            // If root check fails but it's a mount, we might simulate root stat
            if (relativePath === '' || relativePath === '/') {
                return {
                    size: 0,
                    modified: new Date(),
                    birthtime: new Date(),
                    isDirectory: true
                };
            }
            throw error;
        }
    }

    async readdir(relativePath) {
        const contents = await this.client.getDirectoryContents(this._normalizePath(relativePath));
        
        return contents.map(item => ({
            name: item.basename,
            type: item.type === 'directory' ? 'directory' : 'file',
            size: item.size,
            modified: new Date(item.lastmod),
            isDirectory: item.type === 'directory'
        }));
    }

    async readFile(relativePath) {
        // Return Buffer
        return await this.client.getFileContents(this._normalizePath(relativePath), { format: "buffer" });
    }

    async writeFile(relativePath, content) {
        await this.client.putFileContents(this._normalizePath(relativePath), content);
    }

    async delete(relativePath) {
        await this.client.deleteFile(this._normalizePath(relativePath));
    }

    async mkdir(relativePath) {
        await this.client.createDirectory(this._normalizePath(relativePath));
    }

    async rename(oldPath, newPath) {
        await this.client.moveFile(this._normalizePath(oldPath), this._normalizePath(newPath));
    }

    async copy(sourcePath, destPath) {
        await this.client.copyFile(this._normalizePath(sourcePath), this._normalizePath(destPath));
    }
}

module.exports = WebDAVAdapter;
