const db = require('../../config/db');
const { ensure } = require('../../utils/tooljs');

async function getAppData(appId, userId) {
    ensure({ appId, userId });
    
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT key, value, updated_at FROM app_data WHERE app_id = ? AND user_id = ?',
            [appId, userId],
            (err, rows) => {
                if (err) return reject(err);
                
                const data = rows.map(row => {
                    try {
                        return { ...row, value: JSON.parse(row.value) };
                    } catch (e) {
                        return row;
                    }
                });
                resolve(data);
            }
        );
    });
}

async function getAppDataKey(appId, key, userId) {
    ensure({ appId, key, userId });

    return new Promise((resolve, reject) => {
        db.get(
            'SELECT value, updated_at FROM app_data WHERE app_id = ? AND user_id = ? AND key = ?',
            [appId, userId, key],
            (err, row) => {
                if (err) return reject(err);
                if (!row) return reject(new Error('Key not found'));

                try {
                    const value = JSON.parse(row.value);
                    resolve({ key, value, updated_at: row.updated_at });
                } catch (e) {
                    resolve({ key, value: row.value, updated_at: row.updated_at });
                }
            }
        );
    });
}

async function setAppData(appId, key, value, userId) {
    ensure({ appId, key, userId });
    
    const jsonValue = JSON.stringify(value);
    const sql = `
        INSERT INTO app_data (app_id, user_id, key, value, updated_at) 
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(app_id, user_id, key) 
        DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `;

    return new Promise((resolve, reject) => {
        db.run(sql, [appId, userId, key, jsonValue], function(err) {
            if (err) return reject(err);
            resolve(true);
        });
    });
}

async function deleteAppData(appId, key, userId) {
    ensure({ appId, key, userId });

    return new Promise((resolve, reject) => {
        db.run(
            'DELETE FROM app_data WHERE app_id = ? AND user_id = ? AND key = ?',
            [appId, userId, key],
            function(err) {
                if (err) return reject(err);
                if (this.changes === 0) return reject(new Error('Key not found'));
                resolve(true);
            }
        );
    });
}

module.exports = {
    getAppData,
    getAppDataKey,
    setAppData,
    deleteAppData
};