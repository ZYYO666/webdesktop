const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../config/db');
const { JWT_SECRET } = require('../../config/constants');
const { getSetting, dbGet } = require('../../utils/db-utils');
const { ensure } = require('../../utils/tooljs');

async function login(username, password) {
    ensure({ username, password });

    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
            if (err) return reject(err);
            if (!user) return reject(new Error('Invalid credentials'));

            try {
                const allowNonAdminLogin = await getSetting('allowNonAdminLogin', 'true');
                if (allowNonAdminLogin !== 'true' && user.role !== 'admin') {
                    return reject(new Error('Non-admin login is disabled'));
                }

                const validPassword = await bcrypt.compare(password, user.password);
                if (!validPassword) return reject(new Error('Invalid credentials'));

                const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
                
                const enableSso = await getSetting('enableSso', 'false');
                if (enableSso === 'true') {
                    db.run("UPDATE users SET current_token = ? WHERE id = ?", [token, user.id], (err) => {
                        if (err) console.error('Failed to save token:', err.message);
                    });
                }
                
                resolve({ token, user: { id: user.id, username: user.username, role: user.role } });
            } catch (error) {
                reject(error);
            }
        });
    });
}

async function register(username, password) {
    ensure({ username, password });

    const allowRegistration = await getSetting('allowRegistration', 'true');
    if (allowRegistration !== 'true') {
        throw new Error('Registration is disabled');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    return new Promise((resolve, reject) => {
        db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", [username, hashedPassword, 'user'], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return reject(new Error('Username already exists'));
                }
                return reject(err);
            }
            resolve({ id: this.lastID });
        });
    });
}

async function getCurrentUser(userId) {
    ensure({ userId });
    
    const row = await dbGet(
        'SELECT id, username, role, wallpaper, fullscreen_cover_dock, dock_position, dock_mode, window_style FROM users WHERE id = ?',
        [userId]
    );

    if (!row) throw new Error('User not found');

    const fullscreenCoverDock =
        row.fullscreen_cover_dock === 1 ||
        row.fullscreen_cover_dock === '1' ||
        row.fullscreen_cover_dock === true ||
        row.fullscreen_cover_dock === 'true';

    return {
        id: row.id,
        username: row.username,
        role: row.role,
        wallpaper: row.wallpaper || '',
        fullscreenCoverDock,
        dockPosition: row.dock_position || 'bottom',
        dockMode: row.dock_mode || 'floating',
        windowStyle: row.window_style === 'win' ? 'win' : 'mac'
    };
}

async function updateCurrentUser(userId, body) {
    ensure({ userId });
    const { username, password, newPassword, wallpaper, fullscreenCoverDock, dockPosition, dockMode, windowStyle } = body;

    const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) throw new Error('User not found');

    if (username && username !== user.username) {
        const existing = await dbGet('SELECT id FROM users WHERE username = ?', [username]);
        if (existing) throw new Error('Username taken');
    }

    let finalPassword = user.password;
    if (newPassword) {
        if (!password) throw new Error('Current password required to change password');
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) throw new Error('Invalid current password');
        finalPassword = await bcrypt.hash(newPassword, 10);
    }

    const updates = [];
    const params = [];

    if (username) { updates.push('username = ?'); params.push(username); }
    if (newPassword) { updates.push('password = ?'); params.push(finalPassword); }
    if (wallpaper !== undefined) { updates.push('wallpaper = ?'); params.push(wallpaper); }
    if (fullscreenCoverDock !== undefined) { updates.push('fullscreen_cover_dock = ?'); params.push(fullscreenCoverDock); }
    if (dockPosition !== undefined) {
        const p = String(dockPosition || '').toLowerCase();
        const next = (p === 'top' || p === 'right' || p === 'left' || p === 'bottom') ? p : null;
        if (next) { updates.push('dock_position = ?'); params.push(next); }
    }
    if (dockMode !== undefined) {
        const m = String(dockMode || '').toLowerCase();
        const next = (m === 'edge' || m === 'floating') ? m : null;
        if (next) { updates.push('dock_mode = ?'); params.push(next); }
    }
    if (windowStyle !== undefined) { updates.push('window_style = ?'); params.push(windowStyle); }

    if (updates.length === 0) return true;

    params.push(userId);
    
    return new Promise((resolve, reject) => {
        db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
            if (err) return reject(err);
            resolve(true);
        });
    });
}

async function logout(userId) {
    ensure({ userId });
    
    const enableSso = await getSetting('enableSso', 'false');
    if (enableSso === 'true') {
        return new Promise((resolve, reject) => {
            db.run("UPDATE users SET current_token = NULL WHERE id = ?", [userId], (err) => {
                if (err) return reject(err);
                resolve(true);
            });
        });
    }
    return true;
}

module.exports = {
    login,
    register,
    getCurrentUser,
    updateCurrentUser,
    logout
};
