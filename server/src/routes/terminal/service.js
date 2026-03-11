const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const { createError } = require('../../utils/tooljs');
const { isWithinPath } = require('../../services/vfs/utils/path');

const terminalSessions = new Map();
const MAX_OUTPUT_BYTES = 256 * 1024;
const MAX_COMMAND_LENGTH = 1000;
const DEFAULT_TIMEOUT_MS = 15_000;
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;

function toSafeString(value) {
    if (value == null) return '';
    return String(value);
}

function normalizeSessionId(value) {
    const v = String(value ?? '').trim();
    if (!v) return 'default';
    if (v.length > 80) return 'default';
    if (!/^[a-zA-Z0-9_-]+$/.test(v)) return 'default';
    return v;
}

function cleanupSessions() {
    const now = Date.now();
    for (const [key, session] of terminalSessions.entries()) {
        if (!session?.lastUsedAt || now - session.lastUsedAt > SESSION_TTL_MS) {
            terminalSessions.delete(key);
        }
    }
}

async function execOsTerminal(user, body) {
   

    const command = toSafeString(body?.command).trim();
    const sessionId = normalizeSessionId(body?.sessionId);
    if (!command) throw createError('Command required', 400);
    if (command.length > MAX_COMMAND_LENGTH) throw createError('Command too long', 400);
    if (command.includes('\n') || command.includes('\r')) throw createError('Invalid command', 400);

    cleanupSessions();

    const allowedRoot = await (async () => {
        const configured = toSafeString(process.env.OS_TERMINAL_ROOT || process.env.HOME || '/').trim() || '/';
        const resolved = path.resolve(configured);
        try {
            if (await fs.pathExists(resolved)) {
                const stat = await fs.stat(resolved);
                if (stat.isDirectory()) return resolved;
            }
        } catch {
            // ignore
        }
        return '/';
    })();

    const sessionKey = `${user?.id}:${sessionId}`;
    const now = Date.now();

    let session = terminalSessions.get(sessionKey);
    if (!session) {
        session = { cwd: allowedRoot, root: allowedRoot, lastUsedAt: now };
        terminalSessions.set(sessionKey, session);
    } else {
        session.lastUsedAt = now;
        if (!session.root) session.root = allowedRoot;
        if (!session.cwd) session.cwd = session.root;
    }

    if (command === 'pwd' || command === 'pwd -P' || command === 'pwd -L') {
        return {
            stdout: `${session.cwd}\n`,
            stderr: '',
            exitCode: 0,
            signal: null,
            truncated: false,
            timedOut: false,
            cwd: session.cwd
        };
    }

    const cdMatch = command.match(/^cd(?:\s+(.+))?$/);
    if (cdMatch) {
        const arg = (cdMatch[1] ?? '').trim();
        if (arg === '-') throw createError('cd - not supported', 400);

        const targetPath = path.resolve(
            !arg || arg === '~'
                ? session.root
                : arg.startsWith('/') ? arg : path.join(session.cwd, arg)
        );

        if (!isWithinPath(session.root, targetPath)) {
            throw createError('Access denied', 403);
        }
        if (!await fs.pathExists(targetPath)) throw createError('Working directory not found', 404);

        const stat = await fs.stat(targetPath);
        if (!stat.isDirectory()) throw createError('Working directory is not a directory', 400);

        session.cwd = targetPath;
        return {
            stdout: '',
            stderr: '',
            exitCode: 0,
            signal: null,
            truncated: false,
            timedOut: false,
            cwd: session.cwd
        };
    }

    const cwdMarker = '__TERMINAL_CWD__';
    const wrappedCommand = `${command}; printf "\\n${cwdMarker}%s\\n" "$(pwd -P)"`;

    const child = spawn('/bin/zsh', ['-lc', wrappedCommand], {
        cwd: session.cwd,
        env: { ...process.env, TERM: process.env.TERM || 'xterm-256color' }
    });

    let stdout = '';
    let stderr = '';
    let truncated = false;
    let timedOut = false;

    const tryAppend = (target, chunk) => {
        const remaining = MAX_OUTPUT_BYTES - (stdout.length + stderr.length);
        if (remaining <= 0) {
            truncated = true;
            return target;
        }
        const str = chunk.toString('utf8');
        if (str.length <= remaining) return target + str;
        truncated = true;
        return target + str.slice(0, remaining);
    };

    child.stdout.on('data', (d) => {
        stdout = tryAppend(stdout, d);
        if (truncated) child.kill('SIGKILL');
    });

    child.stderr.on('data', (d) => {
        stderr = tryAppend(stderr, d);
        if (truncated) child.kill('SIGKILL');
    });

    const timeoutMs = Number.isFinite(body?.timeoutMs) ? Number(body.timeoutMs) : DEFAULT_TIMEOUT_MS;
    const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
    }, Math.max(1000, Math.min(timeoutMs, 60_000)));

    const result = await new Promise((resolve, reject) => {
        child.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });

        child.on('close', async (code, signal) => {
            clearTimeout(timer);
            let nextCwd = session.cwd;
            const markerIdx = stdout.lastIndexOf(cwdMarker);
            if (markerIdx >= 0) {
                const after = stdout.slice(markerIdx + cwdMarker.length);
                const line = after.split(/\r?\n/)[0] || '';
                const fullCwd = line.trim();

                stdout = stdout.slice(0, Math.max(0, markerIdx)).replace(/\n$/, '');

                if (fullCwd && isWithinPath(session.root, fullCwd) && await fs.pathExists(fullCwd)) {
                    try {
                        const st = await fs.stat(fullCwd);
                        if (st.isDirectory()) nextCwd = path.resolve(fullCwd);
                    } catch {
                        // ignore
                    }
                } else if (fullCwd && !isWithinPath(session.root, fullCwd)) {
                    stderr = `${stderr ? `${stderr}\n` : ''}Working directory escaped root`;
                    if (typeof code === 'number' && code === 0) code = 1;
                }
            }

            session.cwd = nextCwd;
            resolve({
                stdout,
                stderr,
                exitCode: typeof code === 'number' ? code : null,
                signal: signal || null,
                truncated,
                timedOut,
                cwd: session.cwd
            });
        });
    });

    return result;
}

module.exports = { execOsTerminal };
 // if (process.env.ENABLE_OS_TERMINAL !== 'true') {
    //     throw createError('OS terminal disabled', 403);
    // }