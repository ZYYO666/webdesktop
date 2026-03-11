const db = require('../config/db');
const { safeUserIdValue } = require('./tooljs');

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) return reject(err);
    resolve({ changes: this.changes, lastID: this.lastID });
  });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) return reject(err);
    resolve(row ?? null);
  });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) return reject(err);
    resolve(rows || []);
  });
});

const escapeSqliteLike = (input) => String(input).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

const getSetting = async (key, defaultValue) => {
  try {
    const row = await dbGet('SELECT value FROM settings WHERE key = ?', [key]);
    return row ? row.value : defaultValue;
  } catch (err) {
    console.error(`[DB] Error getting setting ${key}:`, err);
    return defaultValue;
  }
};

const getMounts = async (userId = 0) => {
  const safeUserId = safeUserIdValue(userId);
  if (!safeUserId) return [];

  const userMounts = await dbAll(
    'SELECT mountPoint, localPath, type, config FROM user_mounts WHERE user_id = ? ORDER BY length(mountPoint) DESC',
    [safeUserId]
  );

  userMounts.sort((a, b) => String(b.mountPoint || '').length - String(a.mountPoint || '').length);
  return userMounts;
};

const getTableCount = async (table) => {
  const t = String(table || '').trim();
  // Stricter whitelist for table names to prevent SQL injection
  const allowedTables = new Set(['users', 'files', 'settings', 'favorites', 'shares', 'logs', 'user_mounts']);
  if (!allowedTables.has(t)) throw new Error('Invalid table name');
  
  const row = await dbGet(`SELECT count(*) as count FROM ${t}`);
  return Number(row?.count || 0);
};

module.exports = {
  dbRun,
  dbGet,
  dbAll,
  escapeSqliteLike,
  getSetting,
  getMounts,
  getTableCount
};

