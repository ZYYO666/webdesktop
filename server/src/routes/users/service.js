const bcrypt = require('bcryptjs');
const db = require('../../config/db');
const { ensure } = require('../../utils/tooljs');

async function listUsers() {
    return new Promise((resolve, reject) => {
        db.all("SELECT id, username, role, created_at FROM users", [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

async function createUser(username, password, role) {
    ensure({ username, password, role });

    const hashedPassword = await bcrypt.hash(password, 10);
    return new Promise((resolve, reject) => {
        db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", [username, hashedPassword, role], function(err) {
            if (err) return reject(err);
            resolve(true);
        });
    });
}

async function updateUser(id, password, role) {
    ensure({ id });
    const updates = [];
    const params = [];

    if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updates.push("password = ?");
        params.push(hashedPassword);
    }
    if (role) {
        updates.push("role = ?");
        params.push(role);
    }

    if (updates.length === 0) throw new Error('No fields to update');

    params.push(id);
    
    return new Promise((resolve, reject) => {
        db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
            if (err) return reject(err);
            resolve(true);
        });
    });
}

async function deleteUser(id) {
    ensure({ id });

    return new Promise((resolve, reject) => {
        db.run("DELETE FROM users WHERE id = ?", [id], function(err) {
            if (err) return reject(err);
            resolve(true);
        });
    });
}

module.exports = {
    listUsers,
    createUser,
    updateUser,
    deleteUser
};