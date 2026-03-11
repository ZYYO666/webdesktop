const fs = require('fs-extra');
const path = require('path');
const { SYSTEM_ROOT, CONFIG_DIR, CACHE_DIR } = require('../../config/constants');
const { createError } = require('../../utils/tooljs');
const { safeUserIdString } = require('../../services/vfs/utils/user-id');
const { isWithinPath } = require('../../services/vfs/utils/path');
const { dbAll, dbRun } = require('../../utils/db-utils');

function normalizeMountPoint(input) {
    let mp = String(input ?? '').replace(/\\/g, '/').trim();
    if (!mp) return null;
    if (!mp.startsWith('/')) mp = '/' + mp;
    const parts = mp.split('/').filter(Boolean);
    if (parts.includes('..')) return null;
    mp = path.posix.normalize(mp);
    if (!mp.startsWith('/')) mp = '/' + mp;
    if (mp.length > 1) mp = mp.replace(/\/+$/, '');
    if (mp === '/' || mp === '/.') return null;
    if (mp === '/.trash' || mp.startsWith('/.trash/')) return null;
    return mp;
}

function isWithinUserHome(userId, absPath) {
    const userHome = path.resolve(path.join(SYSTEM_ROOT, safeUserIdString(userId)));
    const resolved = path.resolve(String(absPath ?? ''));
    return resolved === userHome || resolved.startsWith(userHome + path.sep);
}

function isLocalMountPathAllowed(userId, absPath) {
    const resolved = path.resolve(String(absPath ?? ''));
    if (!resolved) return false;

    const userHome = path.resolve(path.join(SYSTEM_ROOT, safeUserIdString(userId)));

    if (isWithinPath(CACHE_DIR, resolved)) return false;
    if (isWithinPath(CONFIG_DIR, resolved)) {
        return isWithinPath(userHome, resolved);
    }
    if (isWithinPath(SYSTEM_ROOT, resolved)) {
        return isWithinPath(userHome, resolved);
    }

    return true;
}

function resolveUserLocalPath(userId, localPath) {
    const userHome = path.join(SYSTEM_ROOT, safeUserIdString(userId));
    const raw = String(localPath ?? '').trim();
    if (!raw) return null;

    const base = path.resolve(userHome);

    if (path.isAbsolute(raw)) {
        const resolvedAbs = path.resolve(raw);
        if (resolvedAbs === base || resolvedAbs.startsWith(base + path.sep)) return resolvedAbs;
    }

    const normalizedVirtual = path.posix.normalize('/' + raw.replace(/\\/g, '/'));
    const virtualParts = normalizedVirtual.slice(1).split('/').filter(Boolean);
    const candidateVirtual = path.join(userHome, ...virtualParts);
    const resolvedVirtual = path.resolve(candidateVirtual);
    if (!(resolvedVirtual === base || resolvedVirtual.startsWith(base + path.sep))) return null;
    return resolvedVirtual;
}

function parseConfigValue(input) {
    if (!input) return {};
    if (typeof input === 'object') return input;
    try {
        return JSON.parse(input);
    } catch {
        return {};
    }
}

function deriveDisplayLocalPath(userId, storedLocalPath, parsedConfig) {
    const fromConfig = String(parsedConfig?.originalLocalPath ?? '').trim();
    if (fromConfig) return fromConfig;

    const userHome = path.join(SYSTEM_ROOT, safeUserIdString(userId));
    const base = path.resolve(userHome);
    const resolved = path.resolve(String(storedLocalPath ?? ''));
    if (resolved === base || resolved.startsWith(base + path.sep)) {
        const rel = path.relative(base, resolved).split(path.sep).filter(Boolean).join('/');
        return '/' + rel;
    }

    return String(storedLocalPath ?? '');
}

async function resolveMountLocalPath(userId, localPath) {
    const raw = String(localPath ?? '').trim();
    if (!raw) return null;

    const absCandidate = path.isAbsolute(raw) ? path.resolve(raw) : null;
    if (absCandidate && await fs.pathExists(absCandidate)) return absCandidate;

    const userCandidate = resolveUserLocalPath(userId, raw);
    if (userCandidate && await fs.pathExists(userCandidate)) return userCandidate;

    return null;
}

function formatMountRow(userId, row) {
    const parsedConfig = parseConfigValue(row?.config);
    return { ...row, config: parsedConfig, displayLocalPath: deriveDisplayLocalPath(userId, row?.localPath, parsedConfig) };
}

async function prepareMountForSave(user, payload) {
    const userId = user?.id;
    const normalizedMountPoint = normalizeMountPoint(payload?.mountPoint);
    if (!normalizedMountPoint) throw createError('INVALID_MOUNT_POINT', 400);

    const mountType = payload?.type || 'local';
    let finalLocalPath = payload?.localPath;

    if (mountType === 'local') {
        const resolvedLocalPath = await resolveMountLocalPath(userId, finalLocalPath);
        if (!resolvedLocalPath) throw createError('Local path does not exist', 400);
        if (user?.role !== 'admin' && !isWithinUserHome(userId, resolvedLocalPath)) throw createError('UNAUTHORIZED_MOUNT_PATH', 400);
        if (!isLocalMountPathAllowed(userId, resolvedLocalPath)) throw createError('UNAUTHORIZED_MOUNT_PATH', 400);
        const stat = await fs.stat(resolvedLocalPath);
        if (!stat.isDirectory()) throw createError('Local path must be a directory', 400);
        finalLocalPath = resolvedLocalPath;
    } else {
        finalLocalPath = finalLocalPath || '/dev/null';
    }

    const cfg = parseConfigValue(payload?.config);
    if (mountType === 'local') cfg.originalLocalPath = String(payload?.localPath ?? '').trim();
    const configStr = JSON.stringify(cfg);

    return { mountType, normalizedMountPoint, finalLocalPath, configStr };
}

// Exported Functions

async function listMounts(userId) {
    const rows = await dbAll(
        'SELECT id, mountPoint, localPath, type, config, created_at FROM user_mounts WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
    );
    return rows.map(row => formatMountRow(userId, row));
}

async function addMount(user, body) {
    const { mountType, normalizedMountPoint, finalLocalPath, configStr } = await prepareMountForSave(user, body);

    try {
        const result = await dbRun(
            'INSERT INTO user_mounts (user_id, mountPoint, localPath, type, config) VALUES (?, ?, ?, ?, ?)',
            [user.id, normalizedMountPoint, finalLocalPath, mountType, configStr]
        );
        return { id: result.lastID, mountPoint: normalizedMountPoint };
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            throw createError('Mount point already exists', 409);
        }
        throw err;
    }
}

async function updateMount(user, id, body) {
    const { mountType, normalizedMountPoint, finalLocalPath, configStr } = await prepareMountForSave(user, body);

    try {
        await dbRun(
            'UPDATE user_mounts SET mountPoint = ?, localPath = ?, type = ?, config = ? WHERE id = ? AND user_id = ?',
            [normalizedMountPoint, finalLocalPath, mountType, configStr, id, user.id]
        );
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            throw createError('Mount point already exists', 409);
        }
        throw err;
    }
}

async function deleteMount(userId, id) {
    await dbRun('DELETE FROM user_mounts WHERE id = ? AND user_id = ?', [id, userId]);
}

module.exports = {
    listMounts,
    addMount,
    updateMount,
    deleteMount
};
