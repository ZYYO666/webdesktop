const crypto = require('crypto');
const db = require('../../config/db');
const { normalizePath, getFileStats } = require('../../services/file-service');
const { ensure } = require('../../utils/tooljs');

async function listShares(userId) {
    ensure({ userId });
    
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM share_links WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

async function createShare(filePath, userId) {
    ensure({ filePath, userId });
    const normalizedPath = normalizePath(filePath);

    // Verify file exists and user has access
    const details = await getFileStats(normalizedPath, userId);
    if (details.type === 'directory') {
        throw new Error('Cannot share directories directly yet');
    }

    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM share_links WHERE user_id = ? AND file_path = ?', [userId, normalizedPath], (err, row) => {
            if (err) return reject(err);
            
            if (row) {
                resolve({ exists: true, data: row });
            } else {
                // Generate unique ID
                const id = crypto.randomBytes(6).toString('hex'); // 12 chars
                
                db.run('INSERT INTO share_links (id, user_id, file_path) VALUES (?, ?, ?)', 
                    [id, userId, normalizedPath], 
                    function(err) {
                        if (err) return reject(err);
                        
                        resolve({
                            exists: false,
                            data: {
                                id,
                                user_id: userId,
                                file_path: normalizedPath,
                                created_at: new Date(),
                                downloads: 0
                            }
                        });
                    }
                );
            }
        });
    });
}

async function deleteShare(id, userId) {
    ensure({ id, userId });

    return new Promise((resolve, reject) => {
        db.run('DELETE FROM share_links WHERE id = ? AND user_id = ?', [id, userId], function(err) {
            if (err) return reject(err);
            if (this.changes === 0) return reject(new Error('Link not found'));
            resolve(true);
        });
    });
}

module.exports = {
    listShares,
    createShare,
    deleteShare
};