const db = require('../../config/db');
const { ensure } = require('../../utils/tooljs');

async function getSettings() {
    return new Promise((resolve, reject) => {
        db.all("SELECT key, value FROM settings", [], (err, rows) => {
            if (err) return reject(err);
            const settings = {};
            rows.forEach(row => {
                settings[row.key] = row.value;
            });
            resolve(settings);
        });
    });
}

async function updateSetting(key, value) {
    ensure({ key });
    
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO settings (key, value) VALUES (?, ?) 
                ON CONFLICT(key) DO UPDATE SET value = excluded.value`, 
            [key, value], 
            function(err) {
                if (err) return reject(err);
                resolve(true);
            }
        );
    });
}

async function clearCacheService(clearCacheFn) {
    if (typeof clearCacheFn !== 'function') {
        throw new Error('Clear cache function required');
    }
    return clearCacheFn();
}

module.exports = {
    getSettings,
    updateSetting,
    clearCacheService
};