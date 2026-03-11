const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { spawn } = require('child_process');
const { getSetting } = require('../../utils/db-utils');
const { THUMB_DIR } = require('../../config/constants');
const { vfs } = require('../../services/vfs/ops');
const { getLowercaseExtension } = require('../../services/vfs/utils/file-type');
const { ensure, createError } = require('../../utils/tooljs');

const VIDEO_EXTS = new Set([
    'mp4',
    'm4v',
    'mov',
    'mkv',
    'webm',
    'avi',
    'wmv',
    'flv',
    'm2ts',
    'ts',
    'mts'
]);

const activeFfmpeg = new Set();
let ffmpegCleanupRegistered = false;

function registerFfmpegCleanup() {
    if (ffmpegCleanupRegistered) return;
    ffmpegCleanupRegistered = true;

    const cleanup = () => {
        for (const proc of activeFfmpeg) {
            try {
                if (!proc.killed) proc.kill('SIGTERM');
            } catch (err) { void err; }
        }
    };

    process.once('exit', cleanup);
    process.once('SIGINT', () => {
        cleanup();
        process.exit(0);
    });
    process.once('SIGTERM', () => {
        cleanup();
        process.exit(0);
    });
}

function isVideoExtension(ext) {
    return VIDEO_EXTS.has(String(ext || '').toLowerCase());
}

function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    if (n < min) return min;
    if (n > max) return max;
    return n;
}

function getFfmpegPath() {
    const env = String(process.env.FFMPEG_PATH || '').trim();
    if (env) return env;

    try {
        // eslint-disable-next-line global-require
        const p = require('ffmpeg-static');
        if (p) return p;
    } catch {
        // ignore
    }

    return 'ffmpeg';
}

async function runFfmpegThumbnail({ inputPath, timeSeconds, width }) {
    registerFfmpegCleanup();
    const args = [
        '-hide_banner',
        '-loglevel', 'error',
        '-ss', String(timeSeconds),
        '-i', inputPath,
        '-frames:v', '1',
        '-vf', `scale=${Math.round(width)}:-1:force_original_aspect_ratio=decrease`,
        '-f', 'image2pipe',
        '-vcodec', 'mjpeg',
        'pipe:1'
    ];

    const child = spawn(getFfmpegPath(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
    activeFfmpeg.add(child);
    child.once('close', () => activeFfmpeg.delete(child));
    child.once('error', () => activeFfmpeg.delete(child));

    const chunks = [];
    let stderr = '';

    child.stdout.on('data', (d) => chunks.push(d));
    child.stderr.on('data', (d) => { stderr += d.toString('utf8'); });

    const code = await new Promise((resolve, reject) => {
        child.on('error', (err) => {
            if (err && err.code === 'ENOENT') {
                reject(createError('ffmpeg not found', 500));
                return;
            }
            reject(err);
        });
        child.on('close', resolve);
    }).finally(() => {
        if (child.exitCode === null && !child.killed) {
            try { child.kill('SIGTERM'); } catch (err) { void err; }
        }
    });

    if (code !== 0) {
        throw createError(stderr || 'ffmpeg failed', 500);
    }

    const out = Buffer.concat(chunks);
    if (!out.length) throw createError('Empty thumbnail', 500);
    return out;
}

async function getThumbnail(filePath, userId, options = {}) {
    ensure({ filePath });
    const ctx = vfs.forUser(userId);

    const { cacheKey, path: normalizedPath } = await ctx.statType(filePath, 'file');
    const ext = getLowercaseExtension(normalizedPath);

    const width = clampNumber(options?.width, 64, 1920, 400);
    const timeSeconds = clampNumber(options?.time, 0, 24 * 60 * 60, 1);
    const key = `${cacheKey || normalizedPath}|thumb:v2|w=${width}|t=${timeSeconds}`;
    const cacheHash = crypto.createHash('md5').update(String(key)).digest('hex');
    const cachePath = path.join(THUMB_DIR, `${cacheHash}.jpg`);

    if (await fs.pathExists(cachePath)) {
        const buffer = await fs.readFile(cachePath);
        return { buffer, mimeType: 'image/jpeg' };
    }

    if (isVideoExtension(ext)) {
        const resolved = await ctx.resolve(normalizedPath);
        const adapter = resolved?.node?.adapter;
        const rel = resolved?.node?.relativePath ?? '';

        if (!adapter || typeof adapter.getFullPath !== 'function') {
            throw createError('Video thumbnail is only supported on local mounts for now', 400);
        }

        let fullPath;
        try {
            fullPath = await adapter.getFullPath(rel);
        } catch (err) {
            throw createError(err?.message || 'Invalid path', 400);
        }

        const outputBuffer = await runFfmpegThumbnail({ inputPath: fullPath, timeSeconds, width });

        await fs.outputFile(cachePath, outputBuffer);
        return { buffer: outputBuffer, mimeType: 'image/jpeg' };
    }

    const { buffer: inputBuffer } = await ctx.readFile(normalizedPath);
    const qualityStr = await getSetting('thumbnailQuality', '90');
    const quality = parseInt(qualityStr) || 90;

    const outputBuffer = await sharp(inputBuffer)
        .rotate()
        .resize(Math.round(width), null, { withoutEnlargement: true })
        .jpeg({ quality: quality })
        .toBuffer();

    await fs.outputFile(cachePath, outputBuffer);
    return { buffer: outputBuffer, mimeType: 'image/jpeg' };
}

module.exports = { getThumbnail, isVideoExtension };
