/**
 * Base File System Adapter Interface
 * All cloud drive adapters should extend this class
 */
class BaseAdapter {
    constructor(mountConfig) {
        this.config = mountConfig || {};
    }

    /**
     * Get file stats
     * @param {string} vfsPath - Path relative to mount root
     * @returns {Promise<object>} - { size, mtime, birthtime, isDirectory, mimeType }
     */
    async getStat(_vfsPath) {
        throw new Error('Not implemented');
    }

    /**
     * List files in directory
     * @param {string} vfsPath - Path relative to mount root
     * @returns {Promise<Array>} - Array of { name, type, size, modified }
     */
    async readdir(_vfsPath) {
        throw new Error('Not implemented');
    }

    /**
     * Read file content
     * @param {string} vfsPath 
     */
    async readFile(_vfsPath) {
        throw new Error('Not implemented');
    }

    /**
     * Write file content
     * @param {string} vfsPath 
     * @param {string|Buffer} content 
     */
    async writeFile(_vfsPath, _content) {
        throw new Error('Not implemented');
    }

    /**
     * Delete file or directory
     * @param {string} vfsPath 
     */
    async delete(_vfsPath) {
        throw new Error('Not implemented');
    }

    /**
     * Create directory
     * @param {string} vfsPath 
     */
    async mkdir(_vfsPath) {
        throw new Error('Not implemented');
    }

    /**
     * Rename/Move
     * @param {string} oldVfsPath 
     * @param {string} newVfsPath 
     */
    async rename(_oldVfsPath, _newVfsPath) {
        throw new Error('Not implemented');
    }
    
    /**
     * Copy
     * @param {string} sourceVfsPath
     * @param {string} destVfsPath
     */
    async copy(_sourceVfsPath, _destVfsPath) {
        throw new Error('Not implemented');
    }
}

module.exports = BaseAdapter;
