const db = require('../../config/db');
const { defaultInferActionFrom } = require('../../utils/tooljs');
const { escapeSqliteLike } = require('../../utils/db-utils');

async function getLogs(query) {
    const limitRaw = Number(query.limit ?? 200);
    const offsetRaw = Number(query.offset ?? 0);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 200;
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.floor(offsetRaw)) : 0;

    const filters = [];
    const params = [];

    const fromRaw = query.from;
    const toRaw = query.to;
    const statusRaw = query.status;
    const methodRaw = query.method;
    const userIdRaw = query.userId;
    const qRaw = String(query.q || '').trim();

    const from = fromRaw != null ? Number(fromRaw) : null;
    const to = toRaw != null ? Number(toRaw) : null;
    const statusText = statusRaw != null ? String(statusRaw).trim() : '';
    const status = statusText ? Number(statusText) : null;
    const userId = userIdRaw != null ? Number(userIdRaw) : null;
    const method = methodRaw ? String(methodRaw).toUpperCase() : '';

    if (Number.isFinite(from)) {
        filters.push('ts >= ?');
        params.push(from);
    }

    if (Number.isFinite(to)) {
        filters.push('ts <= ?');
        params.push(to);
    }

    if (Number.isFinite(status)) {
        if (status >= 0 && status < 10) {
            filters.push('status BETWEEN ? AND ?');
            params.push(status * 100, status * 100 + 99);
        } else {
            filters.push('status = ?');
            params.push(status);
        }
    }

    if (method) {
        filters.push('UPPER(method) = ?');
        params.push(method);
    }

    if (Number.isFinite(userId)) {
        filters.push('user_id = ?');
        params.push(userId);
    }

    if (qRaw) {
        const like = `%${escapeSqliteLike(qRaw)}%`;
        filters.push('(path LIKE ? ESCAPE \'\\\' OR action LIKE ? ESCAPE \'\\\' OR ip LIKE ? ESCAPE \'\\\' OR user_agent LIKE ? ESCAPE \'\\\')');
        params.push(like, like, like, like);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    return new Promise((resolve, reject) => {
        db.get(`SELECT COUNT(*) AS total FROM request_logs ${where}`, params, (err, countRow) => {
            if (err) return reject(err);

            db.all(
                `SELECT id, ts, method, path, query, status, duration_ms, ip, user_agent, user_id, user_role, action, req_body, res_size
                 FROM request_logs
                 ${where}
                 ORDER BY ts DESC
                 LIMIT ? OFFSET ?`,
                [...params, limit, offset],
                (err2, rows) => {
                    if (err2) return reject(err2);

                    const normalizedRows = (rows || []).map((row) => {
                        if (row && !row.action) {
                            const inferred = defaultInferActionFrom(row.method, row.path);
                            if (inferred) return { ...row, action: inferred };
                        }
                        return row;
                    });
                    resolve({ total: countRow?.total || 0, rows: normalizedRows });
                }
            );
        });
    });
}

module.exports = {
    getLogs
};