const db = require('../../config/db');
const { getFileStats, getPathBasename, normalizePath } = require('../../services/file-service');
const { ensure } = require('../../utils/tooljs');

// Helper to check if a file exists and get info
async function getFavoriteFileInfo(filePath, userId) {
    try {
        return await getFileStats(filePath, userId);
    } catch (err) {
        // If file not found, return null so we can handle it as "missing"
        if (err.message === 'Path not found' || err.message === 'INVALID_PATH') {
            return null;
        }
        console.error(`Error resolving favorite ${filePath}: ${err.message}`);
        return null;
    }
}

async function listFavorites(userId) {
    ensure({ userId });
    
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM favorites WHERE user_id = ? ORDER BY created_at DESC', [userId], async (err, rows) => {
            if (err) return reject(err);

            const results = [];
            for (const row of rows) {
                const info = await getFavoriteFileInfo(row.path, userId);
                if (info) {
                    results.push({
                        ...info,
                        isFavorite: true,
                        favoriteId: row.id,
                        path: row.path
                    });
                } else {
                    results.push({
                        name: getPathBasename(row.path),
                        path: row.path,
                        type: 'unknown',
                        size: 0,
                        mtime: new Date(row.created_at),
                        isFavorite: true,
                        favoriteId: row.id,
                        missing: true
                    });
                }
            }
            resolve(results);
        });
    });
}

async function addFavorite(filePath, userId) {
    ensure({ filePath, userId });

    const normalizedPath = normalizePath(filePath);
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO favorites (user_id, path) VALUES (?, ?)', [userId, normalizedPath], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    // Treat as success
                    return resolve({ alreadyExists: true, id: null, path: normalizedPath });
                }
                return reject(err);
            }
            resolve({ id: this.lastID, path: normalizedPath });
        });
    });
}

async function removeFavorite(filePath, userId) {
    ensure({ filePath, userId });

    const normalizedPath = normalizePath(filePath);
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM favorites WHERE user_id = ? AND path = ?', [userId, normalizedPath], function(err) {
            if (err) return reject(err);
            if (this.changes === 0) return reject(new Error('Favorite not found'));
            resolve(true);
        });
    });
}

module.exports = {
    listFavorites,
    addFavorite,
    removeFavorite
};