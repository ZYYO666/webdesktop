const axios = require('axios');
const crypto = require('crypto');
const dns = require('dns').promises;
const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const { pipeline } = require('stream/promises');
const { vfs } = require('../../services/vfs/ops');
const { dbAll, dbGet, dbRun } = require('../../utils/db-utils');
const { ensure, createError } = require('../../utils/tooljs');

const tasks = new Map();
const queue = [];
const MAX_TASKS_IN_MEMORY = 400;
const MAX_CONCURRENT = 2;
const MAX_CONCURRENT_PER_USER = 1;
const MAX_NON_LOCAL_BYTES = 100 * 1024 * 1024;
const MAX_RETRIES = 5;
const PERSIST_INTERVAL_MS = 2000;
const MAX_REDIRECTS = 5;
const PLAYLIST_MAX_BYTES = Math.max(64 * 1024, Number(process.env.DOWNLOADER_PLAYLIST_MAX_BYTES || 2 * 1024 * 1024));
const DNS_CACHE_TTL_MS = Math.max(10 * 1000, Number(process.env.DOWNLOADER_DNS_CACHE_TTL_MS || 5 * 60 * 1000));
const DNS_CACHE_MAX = Math.max(50, Number(process.env.DOWNLOADER_DNS_CACHE_MAX || 500));

let pumpScheduled = false;
let runningCount = 0;
const runningByUser = new Map();
const dnsSafetyCache = new Map();
const activeChildren = new Set();
let childrenCleanupRegistered = false;

function registerChildrenCleanup() {
  if (childrenCleanupRegistered) return;
  childrenCleanupRegistered = true;
  const cleanup = () => {
    for (const proc of activeChildren) {
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

function now() {
  return Date.now();
}

function safeJsonStringify(value, maxLen = 4000) {
  try {
    const json = JSON.stringify(value);
    if (!json) return null;
    if (json.length <= maxLen) return json;
    return `${json.slice(0, maxLen)}…`;
  } catch {
    return null;
  }
}

function isPrivateIp(ip) {
  const s = String(ip || '').trim().toLowerCase();
  if (!s) return true;
  if (s === '::1') return true;
  if (s.startsWith('fe80:')) return true;
  if (s.startsWith('fc') || s.startsWith('fd')) return true;
  if (s.startsWith('127.')) return true;
  if (s.startsWith('10.')) return true;
  if (s.startsWith('192.168.')) return true;
  const m172 = s.match(/^172\.(\d+)\./);
  if (m172) {
    const n = Number(m172[1]);
    if (n >= 16 && n <= 31) return true;
  }
  return false;
}

async function assertSafeRemoteUrl(url) {
  const u = new URL(String(url));
  if (!['http:', 'https:'].includes(u.protocol)) {
    throw createError('Only http/https URLs are allowed', 400);
  }

  const host = u.hostname;
  if (!host) throw createError('Invalid URL host', 400);
  if (host === 'localhost') throw createError('Blocked host', 400);

  const cached = dnsSafetyCache.get(host);
  if (cached && now() - cached.ts < DNS_CACHE_TTL_MS) {
    if (!cached.ok) throw createError(cached.msg || 'Blocked host', cached.status || 400);
    return u.toString();
  }

  try {
    const resolved = await dns.lookup(host, { all: true, verbatim: true }).catch(() => []);
    if (!resolved.length) throw createError('DNS lookup failed', 400);
    for (const r of resolved) {
      if (isPrivateIp(r.address)) throw createError('Blocked private address', 400);
    }
    dnsSafetyCache.set(host, { ok: true, ts: now() });
  } catch (err) {
    dnsSafetyCache.set(host, { ok: false, ts: now(), msg: err?.message || String(err), status: err?.status || 400 });
    throw err;
  }

  if (dnsSafetyCache.size > DNS_CACHE_MAX) {
    const removeCount = dnsSafetyCache.size - DNS_CACHE_MAX;
    let i = 0;
    for (const k of dnsSafetyCache.keys()) {
      dnsSafetyCache.delete(k);
      i += 1;
      if (i >= removeCount) break;
    }
  }

  return u.toString();
}

async function requestWithSafeRedirects({
  url,
  method,
  responseType,
  headers,
  signal,
  timeout,
  validateStatus
}) {
  let current = await assertSafeRemoteUrl(url);
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const res = await axios({
      url: current,
      method,
      responseType,
      maxRedirects: 0,
      timeout,
      headers,
      signal,
      validateStatus: (s) => {
        if ([301, 302, 303, 307, 308].includes(s)) return true;
        return validateStatus(s);
      }
    });

    if (![301, 302, 303, 307, 308].includes(res.status)) return res;

    const loc = res.headers?.location ? String(res.headers.location) : '';
    if (res.data && typeof res.data.destroy === 'function') res.data.destroy();
    if (!loc) throw createError('Redirect without location', 400);

    const next = new URL(loc, current).toString();
    current = await assertSafeRemoteUrl(next);
  }

  throw createError('Too many redirects', 400);
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

async function fetchTextWithSafeRedirects(url, headers, signal) {
  const res = await requestWithSafeRedirects({
    url,
    method: 'GET',
    responseType: 'stream',
    timeout: 30000,
    headers,
    signal,
    validateStatus: (s) => s >= 200 && s < 300
  });

  const contentLength = Number(res.headers?.['content-length'] || 0);
  if (Number.isFinite(contentLength) && contentLength > PLAYLIST_MAX_BYTES) {
    if (res.data && typeof res.data.destroy === 'function') res.data.destroy();
    throw createError('Playlist too large', 400);
  }

  const chunks = [];
  let acc = 0;

  await new Promise((resolve, reject) => {
    const onAbort = () => {
      try { if (res.data && typeof res.data.destroy === 'function') res.data.destroy(); } catch { /* ignore */ }
      reject(createError('Canceled', 499));
    };
    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener('abort', onAbort, { once: true });
    }

    res.data.on('data', (chunk) => {
      acc += chunk.length;
      if (acc > PLAYLIST_MAX_BYTES) {
        try { res.data.destroy(); } catch { /* ignore */ }
        reject(createError('Playlist too large', 400));
        return;
      }
      chunks.push(chunk);
    });
    res.data.on('end', resolve);
    res.data.on('error', reject);
  });

  const buf = Buffer.concat(chunks);
  return { text: buf.toString('utf8'), finalUrl: res?.config?.url ? String(res.config.url) : String(url) };
}

function extractHlsUris(playlistText) {
  const lines = String(playlistText || '').split(/\r?\n/);
  const out = [];

  for (const rawLine of lines) {
    const line = String(rawLine || '').trim();
    if (!line) continue;

    if (line.startsWith('#EXT-X-KEY')) {
      const m = line.match(/URI="([^"]+)"/i);
      if (m && m[1]) out.push(m[1]);
      continue;
    }

    if (line.startsWith('#')) continue;
    out.push(line);
  }

  return out;
}

function parseHlsDurationSeconds(playlistText) {
  const lines = String(playlistText || '').split(/\r?\n/);
  let sum = 0;

  for (const rawLine of lines) {
    const line = String(rawLine || '').trim();
    if (!line) continue;
    const m = line.match(/^#EXTINF:([0-9.]+)/i);
    if (!m) continue;
    const s = Number(m[1]);
    if (!Number.isFinite(s) || s <= 0) continue;
    sum += s;
  }

  return sum > 0 ? sum : 0;
}

function isHlsMasterPlaylist(playlistText) {
  return String(playlistText || '').includes('#EXT-X-STREAM-INF');
}

function parseHlsMasterVariants(playlistText) {
  const lines = String(playlistText || '').split(/\r?\n/);
  const variants = [];
  let pendingBandwidth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = String(lines[i] || '').trim();
    if (!line) continue;
    if (line.startsWith('#EXT-X-STREAM-INF')) {
      const m = line.match(/BANDWIDTH\s*=\s*(\d+)/i);
      pendingBandwidth = m ? Number(m[1]) : 0;
      continue;
    }
    if (pendingBandwidth > 0 && !line.startsWith('#')) {
      variants.push({ bandwidth: pendingBandwidth, uri: line });
      pendingBandwidth = 0;
    }
  }

  return variants;
}

function extractHlsMediaUris(playlistText) {
  const lines = String(playlistText || '').split(/\r?\n/);
  const segments = [];
  const extras = [];

  for (const rawLine of lines) {
    const line = String(rawLine || '').trim();
    if (!line) continue;

    if (line.startsWith('#EXT-X-KEY')) {
      const m = line.match(/URI="([^"]+)"/i);
      if (m && m[1]) extras.push(m[1]);
      continue;
    }

    if (line.startsWith('#EXT-X-MAP')) {
      const m = line.match(/URI="([^"]+)"/i);
      if (m && m[1]) extras.push(m[1]);
      continue;
    }

    if (line.startsWith('#')) continue;
    if (line.toLowerCase().includes('.m3u8')) continue;
    segments.push(line);
  }

  return { segments, extras };
}

async function fetchRemoteSizeBytes(url, headers, signal) {
  const head = await requestWithSafeRedirects({
    url,
    method: 'HEAD',
    responseType: 'stream',
    timeout: 30000,
    headers,
    signal,
    validateStatus: (s) => s >= 200 && s < 400
  }).catch(() => null);

  if (head) {
    try {
      if (head.data && typeof head.data.destroy === 'function') head.data.destroy();
    } catch { /* ignore */ }
    const len = Number(head.headers?.['content-length'] || 0);
    if (Number.isFinite(len) && len > 0) return Math.floor(len);
  }

  const rangeHeaders = { ...normalizeHeaders(headers || {}), Range: 'bytes=0-0' };
  const res = await requestWithSafeRedirects({
    url,
    method: 'GET',
    responseType: 'stream',
    timeout: 30000,
    headers: rangeHeaders,
    signal,
    validateStatus: (s) => s === 206 || (s >= 200 && s < 300)
  }).catch(() => null);

  if (!res) return 0;
  try {
    if (res.data && typeof res.data.destroy === 'function') res.data.destroy();
  } catch { /* ignore */ }

  const contentRange = String(res.headers?.['content-range'] || '');
  const m = contentRange.match(/\/(\d+)\s*$/);
  if (m) {
    const total = Number(m[1]);
    if (Number.isFinite(total) && total > 0) return Math.floor(total);
  }
  const len2 = Number(res.headers?.['content-length'] || 0);
  if (Number.isFinite(len2) && len2 > 0) return Math.floor(len2);
  return 0;
}

async function estimateHlsDurationMs(url, headers, signal) {
  const safeUrl = await assertSafeRemoteUrl(url);
  const { text, finalUrl } = await fetchTextWithSafeRedirects(safeUrl, headers, signal);
  const seconds = parseHlsDurationSeconds(text);
  if (seconds > 0) return Math.floor(seconds * 1000);

  if (!isHlsMasterPlaylist(text)) return 0;
  const variants = parseHlsMasterVariants(text).sort((a, b) => (b.bandwidth || 0) - (a.bandwidth || 0));
  const picked = variants[0]?.uri;
  if (!picked) return 0;

  let abs;
  try {
    abs = new URL(picked, finalUrl).toString();
  } catch {
    return 0;
  }

  await assertSafeRemoteUrl(abs);
  const { text: variantText } = await fetchTextWithSafeRedirects(abs, headers, signal);
  const seconds2 = parseHlsDurationSeconds(variantText);
  if (seconds2 > 0) return Math.floor(seconds2 * 1000);

  return 0;
}

async function estimateHlsTotalBytes(url, headers, signal) {
  const safeUrl = await assertSafeRemoteUrl(url);
  const { text, finalUrl } = await fetchTextWithSafeRedirects(safeUrl, headers, signal);

  if (isHlsMasterPlaylist(text)) {
    const durationSec = parseHlsDurationSeconds(text);
    const variants = parseHlsMasterVariants(text).sort((a, b) => (b.bandwidth || 0) - (a.bandwidth || 0));
    const picked = variants[0] || null;
    if (!picked || !picked.uri) return 0;
    let abs;
    try {
      abs = new URL(picked.uri, finalUrl).toString();
    } catch {
      return 0;
    }
    await assertSafeRemoteUrl(abs);
    const { text: variantText, finalUrl: variantFinalUrl } = await fetchTextWithSafeRedirects(abs, headers, signal);
    const durationSec2 = parseHlsDurationSeconds(variantText);
    const media = extractHlsMediaUris(variantText);

    const probeMax = Math.max(1, Number(process.env.DOWNLOADER_HLS_SIZE_PROBE_MAX || 20));
    const sample = media.segments.slice(0, probeMax);
    let sum = 0;
    let count = 0;

    for (const u of sample) {
      let segAbs;
      try {
        segAbs = new URL(u, variantFinalUrl).toString();
      } catch {
        continue;
      }
      await assertSafeRemoteUrl(segAbs);
      const size = await fetchRemoteSizeBytes(segAbs, headers, signal).catch(() => 0);
      if (size > 0) {
        sum += size;
        count += 1;
      }
    }

    const avg = count > 0 ? sum / count : 0;
    const avgEstimate = avg > 0 ? Math.floor(avg * media.segments.length) : 0;
    const bw = Number(picked.bandwidth || 0);
    const dur = durationSec2 > 0 ? durationSec2 : durationSec;
    const bwEstimate = bw > 0 && dur > 0 ? Math.floor((bw / 8) * dur) : 0;
    return Math.max(avgEstimate, bwEstimate);
  }

  const media = extractHlsMediaUris(text);
  const probeMax = Math.max(1, Number(process.env.DOWNLOADER_HLS_SIZE_PROBE_MAX || 20));
  const sample = media.segments.slice(0, probeMax);
  let sum = 0;
  let count = 0;

  for (const u of sample) {
    let segAbs;
    try {
      segAbs = new URL(u, finalUrl).toString();
    } catch {
      continue;
    }
    await assertSafeRemoteUrl(segAbs);
    const size = await fetchRemoteSizeBytes(segAbs, headers, signal).catch(() => 0);
    if (size > 0) {
      sum += size;
      count += 1;
    }
  }

  const avg = count > 0 ? sum / count : 0;
  const avgEstimate = avg > 0 ? Math.floor(avg * media.segments.length) : 0;
  return avgEstimate;
}

function parseFfmpegOutTimeToMs(value) {
  const s = String(value || '').trim();
  const m = s.match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);
  if (!m) return 0;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = Number(m[3]);
  if (![hh, mm, ss].every((n) => Number.isFinite(n) && n >= 0)) return 0;
  return Math.floor(((hh * 60 + mm) * 60 + ss) * 1000);
}

async function updateTaskFromPartFileSize(task, partPath) {
  const t = now();
  if (task._m3u8StatAt && t - task._m3u8StatAt < 1000) return;
  task._m3u8StatAt = t;

  const st = await fs.stat(partPath).catch(() => null);
  const size = st && Number.isFinite(st.size) ? Math.max(0, Math.floor(st.size)) : 0;
  if (size > 0) {
    task.downloadedBytes = size;
    if (task.totalBytes > 0 && task.downloadedBytes > task.totalBytes) task.totalBytes = task.downloadedBytes;
    task.updatedAt = now();
    await persistTaskThrottled(task, false);
  }
}

async function assertSafeHlsPlaylistTree(url, headers, signal) {
  const visited = new Set();
  let checked = 0;
  const maxChecked = Math.max(1000, Number(process.env.DOWNLOADER_HLS_MAX_URIS || 50000));
  const maxDepth = Math.max(0, Number(process.env.DOWNLOADER_HLS_MAX_DEPTH || 2));
  const maxUniqueHosts = Math.max(1, Number(process.env.DOWNLOADER_HLS_MAX_HOSTS || 30));
  const uniqueHosts = new Set();

  async function visit(playlistUrl, depth) {
    if (depth > maxDepth) return;
    const safeUrl = await assertSafeRemoteUrl(playlistUrl);
    if (visited.has(safeUrl)) return;
    visited.add(safeUrl);

    const { text, finalUrl } = await fetchTextWithSafeRedirects(safeUrl, headers, signal);
    const uris = extractHlsUris(text);

    for (const u of uris) {
      checked += 1;
      if (checked > maxChecked) throw createError('Playlist too large', 400);
      let abs;
      try {
        abs = new URL(u, finalUrl).toString();
      } catch {
        throw createError('Invalid playlist URI', 400);
      }

      let host = '';
      try {
        host = new URL(abs).hostname;
      } catch {
        host = '';
      }
      if (host && !uniqueHosts.has(host)) {
        uniqueHosts.add(host);
        if (uniqueHosts.size > maxUniqueHosts) throw createError('Playlist references too many hosts', 400);
      }

      await assertSafeRemoteUrl(abs);
      if (abs.toLowerCase().includes('.m3u8')) {
        await visit(abs, depth + 1);
      }
    }
  }

  await visit(url, 0);
}

function sanitizeFilename(input) {
  const raw = String(input || '').replace(/\\/g, '/').trim();
  const base = path.posix.basename(raw);
  const cleaned = [...base].filter((ch) => {
    const code = ch.codePointAt(0);
    if (!Number.isFinite(code)) return false;
    if (code < 32) return false;
    if (code === 127) return false;
    return true;
  }).join('').trim();
  return cleaned;
}

function parseContentDispositionFilename(headerValue) {
  const v = String(headerValue || '');
  if (!v) return '';

  const mStar = v.match(/filename\*\s*=\s*([^;]+)/i);
  if (mStar) {
    const token = mStar[1].trim();
    const parts = token.split("''");
    if (parts.length === 2) {
      const encoded = parts[1].trim().replace(/^"|"$/g, '');
      try {
        return decodeURIComponent(encoded);
      } catch {
        return encoded;
      }
    }
  }

  const m = v.match(/filename\s*=\s*("([^"]+)"|([^;]+))/i);
  if (!m) return '';
  return (m[2] || m[3] || '').trim();
}

function guessFilenameFromUrl(url) {
  try {
    const u = new URL(String(url));
    const name = path.posix.basename(u.pathname || '');
    return name && name !== '/' ? name : '';
  } catch {
    return '';
  }
}

function normalizeMp4Filename(input, url) {
  const base = sanitizeFilename(input) || sanitizeFilename(guessFilenameFromUrl(url)) || 'video.mp4';
  const lower = base.toLowerCase();
  if (lower.endsWith('.mp4')) return base;
  if (lower.endsWith('.m3u8')) return `${base.slice(0, -5)}.mp4`;
  return `${base}.mp4`;
}

function normalizeHeaders(input) {
  if (!input || typeof input !== 'object') return {};
  const blocked = new Set(['host', 'content-length', 'connection']);
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    const rawKey = String(k || '').trim();
    if (!rawKey) continue;
    const lower = rawKey.toLowerCase();
    if (blocked.has(lower)) continue;
    const val = String(v ?? '').replace(/[\r\n]+/g, ' ').trim();
    if (!val) continue;
    if (rawKey.length > 60 || val.length > 4000) continue;
    out[rawKey] = val;
  }
  return out;
}

function toFfmpegHeadersString(headers) {
  const h = normalizeHeaders(headers);
  let out = '';
  for (const [k, v] of Object.entries(h)) {
    out += `${k}: ${v}\r\n`;
  }
  return out;
}

function normalizeStatus(status) {
  const s = String(status || '');
  const allowed = new Set(['queued', 'running', 'paused', 'completed', 'failed', 'canceled']);
  return allowed.has(s) ? s : 'queued';
}

function normalizeKind(kind) {
  const k = String(kind || '');
  const allowed = new Set(['http', 'm3u8-to-mp4']);
  return allowed.has(k) ? k : 'http';
}

function asBooleanInt(value) {
  return value === true || value === 1 || value === '1' ? 1 : 0;
}

function computeSpeed(task) {
  const t = now();
  if (!task._speed) {
    task._speed = { ts: t, bytes: task.downloadedBytes || 0, speed: 0 };
    return 0;
  }
  const dt = (t - task._speed.ts) / 1000;
  if (dt <= 0) return task._speed.speed || 0;
  const db = (task.downloadedBytes || 0) - (task._speed.bytes || 0);
  const instant = db / dt;
  const smoothed = task._speed.speed ? (task._speed.speed * 0.7 + instant * 0.3) : instant;
  task._speed = { ts: t, bytes: task.downloadedBytes || 0, speed: smoothed };
  return smoothed;
}

function toPublicTask(task) {
  const kind = normalizeKind(task.kind);
  const speed = computeSpeed(task);
  const total = Number(task.totalBytes || 0);
  const done = Number(task.downloadedBytes || 0);
  const eta = speed > 0 && total > 0 && done <= total ? Math.max(0, Math.floor((total - done) / speed)) : null;

  return {
    id: task.id,
    kind,
    url: task.url,
    dirPath: task.dirPath,
    targetPath: task.targetPath,
    filename: task.filename,
    status: task.status,
    totalBytes: task.totalBytes,
    downloadedBytes: task.downloadedBytes,
    speedBytesPerSec: Math.floor(speed),
    etaSeconds: eta,
    retryCount: task.retryCount || 0,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    finishedAt: task.finishedAt,
    updatedAt: task.updatedAt,
    error: task.error ? String(task.error) : null,
    meta: task.meta && typeof task.meta === 'object' ? task.meta : null
  };
}

async function chooseUniqueTargetPath(ctx, dirPath, filename, overwrite) {
  const base = sanitizeFilename(filename);
  if (!base) throw createError('Filename required', 400);

  const dot = base.lastIndexOf('.');
  const namePart = dot > 0 ? base.slice(0, dot) : base;
  const extPart = dot > 0 ? base.slice(dot) : '';

  let candidate = ctx.path.child(dirPath, base);
  if (overwrite) return candidate;
  if (!await ctx.existsPath(candidate)) return candidate;

  for (let i = 1; i <= 999; i++) {
    const next = `${namePart} (${i})${extPart}`;
    candidate = ctx.path.child(dirPath, next);
    if (!await ctx.existsPath(candidate)) return candidate;
  }

  return ctx.path.child(dirPath, `${namePart}-${Date.now()}${extPart}`);
}

async function dbUpsertTask(task) {
  const headersJson = safeJsonStringify(normalizeHeaders(task.headers || {}), 20000);
  const metaJson = safeJsonStringify(task.meta && typeof task.meta === 'object' ? task.meta : null, 20000);
  await dbRun(
    `INSERT INTO downloader_tasks
      (id, user_id, kind, url, dir_path, filename, target_path, status, total_bytes, downloaded_bytes, created_at, started_at, finished_at, updated_at, error, headers, overwrite, retry_count, etag, last_modified, meta)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        kind=excluded.kind,
        url=excluded.url,
        dir_path=excluded.dir_path,
        filename=excluded.filename,
        target_path=excluded.target_path,
        status=excluded.status,
        total_bytes=excluded.total_bytes,
        downloaded_bytes=excluded.downloaded_bytes,
        started_at=excluded.started_at,
        finished_at=excluded.finished_at,
        updated_at=excluded.updated_at,
        error=excluded.error,
        headers=excluded.headers,
        overwrite=excluded.overwrite,
        retry_count=excluded.retry_count,
        etag=excluded.etag,
        last_modified=excluded.last_modified,
        meta=excluded.meta`,
    [
      task.id,
      task.userId,
      normalizeKind(task.kind),
      task.url,
      task.dirPath,
      task.filename || null,
      task.targetPath || null,
      task.status,
      Number(task.totalBytes || 0),
      Number(task.downloadedBytes || 0),
      Number(task.createdAt || now()),
      task.startedAt ? Number(task.startedAt) : null,
      task.finishedAt ? Number(task.finishedAt) : null,
      Number(task.updatedAt || now()),
      task.error ? String(task.error).slice(0, 1000) : null,
      headersJson,
      asBooleanInt(task.overwrite),
      Number(task.retryCount || 0),
      task.etag || null,
      task.lastModified || null,
      metaJson
    ]
  );
}

async function dbGetTaskRow(id) {
  return await dbGet('SELECT * FROM downloader_tasks WHERE id = ?', [String(id || '')]);
}

async function dbListTaskRows(userId, limit = 100) {
  return await dbAll(
    'SELECT * FROM downloader_tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, Math.max(1, Math.min(200, limit))]
  );
}

function rowToTask(row) {
  let headers = {};
  if (row?.headers) {
    try {
      headers = JSON.parse(String(row.headers));
    } catch {
      headers = {};
    }
  }

  let meta = null;
  if (row?.meta) {
    try {
      meta = JSON.parse(String(row.meta));
    } catch {
      meta = null;
    }
  }

  return {
    id: String(row.id),
    userId: Number(row.user_id),
    kind: normalizeKind(row.kind),
    url: String(row.url),
    dirPath: String(row.dir_path || '/'),
    filename: String(row.filename || ''),
    targetPath: String(row.target_path || ''),
    status: normalizeStatus(row.status),
    totalBytes: Number(row.total_bytes || 0),
    downloadedBytes: Number(row.downloaded_bytes || 0),
    retryCount: Number(row.retry_count || 0),
    createdAt: Number(row.created_at || now()),
    startedAt: row.started_at ? Number(row.started_at) : null,
    finishedAt: row.finished_at ? Number(row.finished_at) : null,
    updatedAt: Number(row.updated_at || now()),
    error: row.error ? String(row.error) : null,
    headers,
    overwrite: row.overwrite === 1 || row.overwrite === '1' || row.overwrite === true,
    etag: row.etag ? String(row.etag) : null,
    lastModified: row.last_modified ? String(row.last_modified) : null,
    meta: meta && typeof meta === 'object' ? meta : null,
    _abort: null,
    _persistAt: 0,
    _speed: null
  };
}

function trimTasksInMemory() {
  if (tasks.size <= MAX_TASKS_IN_MEMORY) return;
  const list = [...tasks.values()].sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
  const removeCount = tasks.size - MAX_TASKS_IN_MEMORY;
  for (let i = 0; i < removeCount; i++) {
    tasks.delete(list[i].id);
  }
}

async function persistTaskThrottled(task, force = false) {
  const t = now();
  if (!force && task._persistAt && t - task._persistAt < PERSIST_INTERVAL_MS) return;
  task._persistAt = t;
  await dbUpsertTask(task);
}

function schedulePump() {
  if (pumpScheduled) return;
  pumpScheduled = true;
  setImmediate(() => {
    pumpScheduled = false;
    void pumpQueue();
  });
}

function canRunTask(task) {
  const u = String(task.userId);
  const c = runningByUser.get(u) || 0;
  return c < MAX_CONCURRENT_PER_USER;
}

async function pumpQueue() {
  if (runningCount >= MAX_CONCURRENT) return;
  if (!queue.length) return;

  let idx = 0;
  while (runningCount < MAX_CONCURRENT && idx < queue.length) {
    const id = queue[idx];
    const task = tasks.get(id);
    if (!task) {
      queue.splice(idx, 1);
      continue;
    }
    if (task.status !== 'queued') {
      queue.splice(idx, 1);
      continue;
    }
    if (!canRunTask(task)) {
      idx++;
      continue;
    }
    queue.splice(idx, 1);
    void startTask(task);
  }
}

function markRunning(task) {
  runningCount += 1;
  const u = String(task.userId);
  runningByUser.set(u, (runningByUser.get(u) || 0) + 1);
}

function markStopped(task) {
  runningCount = Math.max(0, runningCount - 1);
  const u = String(task.userId);
  const next = Math.max(0, (runningByUser.get(u) || 0) - 1);
  if (next === 0) runningByUser.delete(u);
  else runningByUser.set(u, next);
}

function isAbortError(err) {
  const code = err?.code || err?.name;
  if (code === 'ERR_CANCELED') return true;
  if (code === 'AbortError') return true;
  if (String(err?.message || '').toLowerCase().includes('aborted')) return true;
  return false;
}

function isRetriableError(err) {
  if (!err) return false;
  if (isAbortError(err)) return false;
  const status = Number(err?.response?.status || 0);
  if ([408, 425, 429, 500, 502, 503, 504].includes(status)) return true;
  const code = String(err?.code || '');
  if (['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND', 'ECONNREFUSED'].includes(code)) return true;
  return false;
}

function delayMs(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (!signal) return;
    if (signal.aborted) {
      clearTimeout(timer);
      reject(createError('Canceled', 499));
      return;
    }
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(createError('Canceled', 499));
    }, { once: true });
  });
}

async function pickTargetPathIfNeeded(task) {
  if (task.targetPath) return task.targetPath;
  if (!task.filename) task.filename = sanitizeFilename(guessFilenameFromUrl(task.url)) || 'download.bin';
  const ctx = vfs.forUser(task.userId);
  const { path: normalizedDir } = await ctx.statType(task.dirPath || '/', 'directory');
  task.targetPath = await chooseUniqueTargetPath(ctx, normalizedDir, task.filename, task.overwrite);
  task.updatedAt = now();
  await persistTaskThrottled(task, true);
  return task.targetPath;
}

async function resolveLocalFullPath(task) {
  const targetPath = await pickTargetPathIfNeeded(task);
  const ctx = vfs.forUser(task.userId);
  const resolved = await ctx.resolve(targetPath);
  const node = resolved.node;
  const adapter = node.adapter;
  if (!adapter || typeof adapter.getFullPath !== 'function') return null;
  return { adapter, relativePath: node.relativePath, fullPath: await adapter.getFullPath(node.relativePath) };
}

function parseTotalFromHeaders(headers, startAt) {
  const h = headers || {};
  const contentRange = String(h['content-range'] || h['Content-Range'] || '');
  const m = contentRange.match(/\/(\d+)\s*$/);
  if (m) return Number(m[1]) || 0;
  const len = Number(h['content-length'] || h['Content-Length'] || 0);
  if (len > 0) return Number(startAt || 0) + len;
  return 0;
}

async function downloadToLocal(task, controller) {
  const local = await resolveLocalFullPath(task);
  if (!local) throw createError('Target mount does not support streaming writes for large files', 400);
  const { fullPath } = local;
  await fs.ensureDir(path.dirname(fullPath));

  const partPath = `${fullPath}.part`;

  let startAt = 0;
  if (await fs.pathExists(partPath)) {
    const st = await fs.stat(partPath).catch(() => null);
    startAt = st && Number.isFinite(st.size) ? st.size : 0;
  }

  if (task.overwrite && await fs.pathExists(fullPath)) {
    await fs.remove(fullPath).catch(() => void 0);
  }

  const headers = normalizeHeaders(task.headers || {});
  if (startAt > 0) {
    headers.Range = `bytes=${startAt}-`;
    if (task.etag) headers['If-Range'] = task.etag;
    else if (task.lastModified) headers['If-Range'] = task.lastModified;
  }

  const res = await requestWithSafeRedirects({
    url: task.url,
    method: 'GET',
    responseType: 'stream',
    timeout: 30000,
    headers,
    signal: controller.signal,
    validateStatus: (s) => s === 200 || s === 206
  });

  const etag = res.headers?.etag ? String(res.headers.etag) : null;
  const lastModified = res.headers?.['last-modified'] ? String(res.headers['last-modified']) : null;
  if (etag) task.etag = etag;
  if (lastModified) task.lastModified = lastModified;

  if (startAt > 0 && res.status === 200) {
    await fs.remove(partPath).catch(() => void 0);
    task.downloadedBytes = 0;
    task.totalBytes = 0;
    task.etag = etag;
    task.lastModified = lastModified;
    return await downloadToLocal(task, controller);
  }

  task.downloadedBytes = startAt;
  task.totalBytes = parseTotalFromHeaders(res.headers, startAt) || task.totalBytes || 0;
  task.updatedAt = now();

  const writeStream = fs.createWriteStream(partPath, { flags: startAt > 0 ? 'a' : 'w' });
  res.data.on('data', (chunk) => {
    task.downloadedBytes = (task.downloadedBytes || 0) + chunk.length;
    task.updatedAt = now();
    void persistTaskThrottled(task, false);
  });

  await pipeline(res.data, writeStream);
  await fs.move(partPath, fullPath, { overwrite: false });
}

async function downloadToNonLocal(task, controller) {
  await pickTargetPathIfNeeded(task);
  task.downloadedBytes = 0;
  task.totalBytes = 0;
  task.updatedAt = now();
  await persistTaskThrottled(task, true);
  const headers = normalizeHeaders(task.headers || {});
  const res = await requestWithSafeRedirects({
    url: task.url,
    method: 'GET',
    responseType: 'stream',
    timeout: 30000,
    headers,
    signal: controller.signal,
    validateStatus: (s) => s >= 200 && s < 300
  });

  const total = Number(res.headers?.['content-length'] || 0);
  if (Number.isFinite(total) && total > 0) task.totalBytes = total;
  if (task.totalBytes && task.totalBytes > MAX_NON_LOCAL_BYTES) {
    throw createError('Downloaded file too large for this mount', 400);
  }

  const ctx = vfs.forUser(task.userId);
  const chunks = [];
  let acc = 0;

  await new Promise((resolve, reject) => {
    res.data.on('data', (chunk) => {
      acc += chunk.length;
      task.downloadedBytes = (task.downloadedBytes || 0) + chunk.length;
      task.updatedAt = now();
      void persistTaskThrottled(task, false);
      if (acc > MAX_NON_LOCAL_BYTES) {
        controller.abort();
        reject(createError('Downloaded file too large for this mount', 400));
        return;
      }
      chunks.push(chunk);
    });
    res.data.on('end', resolve);
    res.data.on('error', reject);
  });

  const buffer = Buffer.concat(chunks);
  await ctx.writeFile(task.targetPath, buffer);
}

async function convertM3u8ToMp4(task, controller) {
  registerChildrenCleanup();
  await pickTargetPathIfNeeded(task);

  const local = await resolveLocalFullPath(task);
  if (!local) throw createError('m3u8 to mp4 is only supported on local mounts for now', 400);
  const { fullPath } = local;
  await fs.ensureDir(path.dirname(fullPath));

  const partPath = `${fullPath}.part`;
  if (task.overwrite && await fs.pathExists(fullPath)) {
    await fs.remove(fullPath).catch(() => void 0);
  }
  await fs.remove(partPath).catch(() => void 0);

  const headers = normalizeHeaders(task.headers || {});
  await assertSafeHlsPlaylistTree(task.url, headers, controller.signal);

  const durationMs = await estimateHlsDurationMs(task.url, headers, controller.signal).catch(() => 0);
  const estimatedTotalBytes = await estimateHlsTotalBytes(task.url, headers, controller.signal).catch(() => 0);

  if (!task.meta || typeof task.meta !== 'object') task.meta = { output: 'mp4', input: 'm3u8' };
  if (durationMs > 0) task.meta.durationMs = durationMs;
  task.meta.progressMs = 0;
  task.meta.speedX = 0;

  task.totalBytes = estimatedTotalBytes > 0 ? estimatedTotalBytes : 0;
  task.downloadedBytes = 0;
  task.updatedAt = now();
  await persistTaskThrottled(task, true);

  const args = [
    '-hide_banner',
    '-loglevel', 'error'
  ];

  const ffHeaders = toFfmpegHeadersString(headers);
  if (ffHeaders) args.push('-headers', ffHeaders);

  args.push(
    '-i', task.url,
    '-c', 'copy',
    '-bsf:a', 'aac_adtstoasc',
    '-movflags', '+faststart',
    '-progress', 'pipe:2',
    '-nostats',
    '-f', 'mp4',
    partPath
  );

  const child = spawn(getFfmpegPath(), args, { stdio: ['ignore', 'ignore', 'pipe'] });
  activeChildren.add(child);
  child.once('close', () => activeChildren.delete(child));
  child.once('error', () => activeChildren.delete(child));
  let stderr = '';
  let stderrLineBuf = '';
  let sizeTimer = setInterval(() => {
    void updateTaskFromPartFileSize(task, partPath);
  }, 1000);
  if (typeof sizeTimer.unref === 'function') sizeTimer.unref();

  const killChild = () => {
    if (child.killed) return;
    if (sizeTimer) {
      clearInterval(sizeTimer);
      sizeTimer = null;
    }
    try { child.kill('SIGTERM'); } catch { /* ignore */ }
    setTimeout(() => {
      try { if (!child.killed) child.kill('SIGKILL'); } catch { /* ignore */ }
    }, 3000);
  };

  if (controller?.signal) {
    if (controller.signal.aborted) killChild();
    else controller.signal.addEventListener('abort', killChild, { once: true });
  }

  child.stderr.on('data', (d) => {
    const s = d.toString('utf8');
    stderrLineBuf += s;

    for (;;) {
      const idx = stderrLineBuf.indexOf('\n');
      if (idx < 0) break;
      const rawLine = stderrLineBuf.slice(0, idx);
      stderrLineBuf = stderrLineBuf.slice(idx + 1);
      const line = String(rawLine || '').trim();
      if (!line) continue;

      const m = line.match(/^([a-zA-Z0-9_]+)=(.*)$/);
      if (!m) {
        if (stderr.length < 20000) stderr += `${line}\n`;
        continue;
      }

      const key = m[1];
      const value = m[2];
      if (key === 'out_time_us' || key === 'out_time_ms') {
        const us = Math.max(0, Math.floor(Number(value || 0)));
        const ms = Math.max(0, Math.floor(us / 1000));
        if (task.meta && typeof task.meta === 'object') task.meta.progressMs = ms;
        task.updatedAt = now();
        void updateTaskFromPartFileSize(task, partPath);
        void persistTaskThrottled(task, false);
        continue;
      }

      if (key === 'out_time') {
        const ms = parseFfmpegOutTimeToMs(value);
        if (ms > 0) {
          if (task.meta && typeof task.meta === 'object') task.meta.progressMs = ms;
          task.updatedAt = now();
          void updateTaskFromPartFileSize(task, partPath);
          void persistTaskThrottled(task, false);
        }
        continue;
      }

      if (key === 'speed') {
        const x = Number(String(value || '').trim().replace(/x$/i, ''));
        if (Number.isFinite(x) && x >= 0) {
          if (task.meta && typeof task.meta === 'object') task.meta.speedX = x;
          task.updatedAt = now();
          void updateTaskFromPartFileSize(task, partPath);
          void persistTaskThrottled(task, false);
        }
        continue;
      }

      if (key === 'progress' && String(value || '').trim() === 'end') {
        task.updatedAt = now();
        void updateTaskFromPartFileSize(task, partPath);
        void persistTaskThrottled(task, false);
      }
    }
  });

  let code;
  try {
    code = await new Promise((resolve, reject) => {
      child.on('error', (err) => {
        if (err && err.code === 'ENOENT') {
          reject(createError('ffmpeg not found', 500));
          return;
        }
        reject(err);
      });
      child.on('close', resolve);
    });
  } finally {
    if (sizeTimer) {
      clearInterval(sizeTimer);
      sizeTimer = null;
    }
  }

  if (controller.signal.aborted) throw createError('Canceled', 499);
  if (code !== 0) throw createError(stderr || 'ffmpeg failed', 500);

  await fs.move(partPath, fullPath, { overwrite: false });
  const outSt = await fs.stat(fullPath).catch(() => null);
  const outSize = outSt && Number.isFinite(outSt.size) ? Math.max(0, Math.floor(outSt.size)) : 0;
  if (outSize > 0) {
    task.downloadedBytes = outSize;
    task.totalBytes = Math.max(Number(task.totalBytes || 0), outSize);
    task.updatedAt = now();
    await persistTaskThrottled(task, true);
  }
}

async function runTaskOnce(task, controller) {
  if (task.status !== 'running') return;
  if (normalizeKind(task.kind) === 'm3u8-to-mp4') {
    await convertM3u8ToMp4(task, controller);
    return;
  }
  const local = await resolveLocalFullPath(task);
  if (local) {
    await downloadToLocal(task, controller);
    return;
  }
  await downloadToNonLocal(task, controller);
}

async function runTaskWithRetry(task, controller) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (controller.signal.aborted) throw createError('Canceled', 499);
    try {
      await runTaskOnce(task, controller);
      return;
    } catch (err) {
      if (controller.signal.aborted || task.status === 'paused' || task.status === 'canceled') throw err;
      if (!isRetriableError(err) || attempt === MAX_RETRIES) throw err;
      task.retryCount = Number(task.retryCount || 0) + 1;
      task.updatedAt = now();
      task.error = err?.message || String(err);
      await persistTaskThrottled(task, true);
      const backoff = Math.min(30000, 500 * (2 ** attempt));
      await delayMs(backoff, controller.signal);
    }
  }
}

async function startTask(task) {
  markRunning(task);
  const controller = new AbortController();
  task._abort = () => controller.abort();

  task.status = 'running';
  task.startedAt = task.startedAt || now();
  task.updatedAt = now();
  task.error = null;
  await persistTaskThrottled(task, true);

  try {
    await runTaskWithRetry(task, controller);
    if (task.status === 'paused' || task.status === 'canceled') return;
    task.status = 'completed';
    task.finishedAt = now();
    task.updatedAt = task.finishedAt;
    task.error = null;
    await persistTaskThrottled(task, true);
  } catch (err) {
    if (task.status === 'paused' || task.status === 'canceled') {
      await persistTaskThrottled(task, true);
      return;
    }
    task.status = 'failed';
    task.error = err?.message || String(err);
    task.finishedAt = now();
    task.updatedAt = task.finishedAt;
    await persistTaskThrottled(task, true);
  } finally {
    task._abort = null;
    markStopped(task);
    schedulePump();
  }
}

function enqueueTask(task) {
  if (task.status !== 'queued') task.status = 'queued';
  if (!queue.includes(task.id)) queue.push(task.id);
  schedulePump();
}

async function createDownloadTask({ url, dirPath, filename, headers, overwrite }, userId) {
  ensure({ url });
  const safeUrl = await assertSafeRemoteUrl(url);

  const id = crypto.randomUUID();
  const task = {
    id,
    userId,
    kind: 'http',
    url: safeUrl,
    dirPath: String(dirPath || '/'),
    filename: sanitizeFilename(filename) || sanitizeFilename(guessFilenameFromUrl(safeUrl)) || 'download.bin',
    targetPath: '',
    status: 'queued',
    totalBytes: 0,
    downloadedBytes: 0,
    retryCount: 0,
    createdAt: now(),
    startedAt: null,
    finishedAt: null,
    updatedAt: now(),
    error: null,
    headers: normalizeHeaders(headers || {}),
    overwrite: overwrite === true,
    etag: null,
    lastModified: null,
    meta: null,
    _abort: null,
    _persistAt: 0,
    _speed: null
  };

  tasks.set(id, task);
  trimTasksInMemory();
  await dbUpsertTask(task);

  enqueueTask(task);
  return toPublicTask(task);
}

async function createM3u8ToMp4Task({ url, dirPath, filename, headers, overwrite }, userId) {
  ensure({ url });
  const safeUrl = await assertSafeRemoteUrl(url);

  const id = crypto.randomUUID();
  const task = {
    id,
    userId,
    kind: 'm3u8-to-mp4',
    url: safeUrl,
    dirPath: String(dirPath || '/'),
    filename: normalizeMp4Filename(filename, safeUrl),
    targetPath: '',
    status: 'queued',
    totalBytes: 0,
    downloadedBytes: 0,
    retryCount: 0,
    createdAt: now(),
    startedAt: null,
    finishedAt: null,
    updatedAt: now(),
    error: null,
    headers: normalizeHeaders(headers || {}),
    overwrite: overwrite === true,
    etag: null,
    lastModified: null,
    meta: { output: 'mp4', input: 'm3u8' },
    _abort: null,
    _persistAt: 0,
    _speed: null
  };

  tasks.set(id, task);
  trimTasksInMemory();
  await dbUpsertTask(task);

  enqueueTask(task);
  return toPublicTask(task);
}

async function getTask(id, userId) {
  const memory = tasks.get(String(id || ''));
  if (memory) {
    if (memory.userId !== userId) throw createError('Access denied', 403);
    return toPublicTask(memory);
  }

  const row = await dbGetTaskRow(id);
  if (!row) throw createError('Task not found', 404);
  if (Number(row.user_id) !== Number(userId)) throw createError('Access denied', 403);

  const task = rowToTask(row);
  tasks.set(task.id, task);
  trimTasksInMemory();
  return toPublicTask(task);
}

async function listTasks(userId) {
  const rows = await dbListTaskRows(userId, 100);
  const merged = [];
  for (const r of rows) {
    const id = String(r.id);
    const memory = tasks.get(id);
    if (memory) merged.push(toPublicTask(memory));
    else merged.push(toPublicTask(rowToTask(r)));
  }
  return merged;
}

async function pauseTask(id, userId) {
  const memory = tasks.get(String(id || ''));
  const row = memory ? null : await dbGetTaskRow(id);
  const task = memory || (row ? rowToTask(row) : null);
  if (!task || !task.id) throw createError('Task not found', 404);
  if (task.userId !== userId) throw createError('Access denied', 403);

  if (task.status === 'completed' || task.status === 'failed' || task.status === 'canceled') return toPublicTask(task);
  task.status = 'paused';
  task.updatedAt = now();
  tasks.set(task.id, task);
  if (typeof task._abort === 'function') task._abort();
  await persistTaskThrottled(task, true);
  return toPublicTask(task);
}

async function resumeTask(id, userId) {
  const memory = tasks.get(String(id || ''));
  const row = memory ? null : await dbGetTaskRow(id);
  const task = memory || (row ? rowToTask(row) : null);
  if (!task || !task.id) throw createError('Task not found', 404);
  if (task.userId !== userId) throw createError('Access denied', 403);

  if (task.status === 'completed' || task.status === 'canceled') return toPublicTask(task);
  task.status = 'queued';
  task.error = null;
  task.finishedAt = null;
  task.updatedAt = now();
  tasks.set(task.id, task);
  await persistTaskThrottled(task, true);
  enqueueTask(task);
  return toPublicTask(task);
}

async function cancelTask(id, userId) {
  const memory = tasks.get(String(id || ''));
  const row = memory ? null : await dbGetTaskRow(id);
  const task = memory || (row ? rowToTask(row) : null);
  if (!task || !task.id) throw createError('Task not found', 404);
  if (task.userId !== userId) throw createError('Access denied', 403);

  if (task.status === 'completed' || task.status === 'failed') return toPublicTask(task);
  task.status = 'canceled';
  task.error = null;
  task.finishedAt = now();
  task.updatedAt = task.finishedAt;
  tasks.set(task.id, task);
  if (typeof task._abort === 'function') task._abort();
  await persistTaskThrottled(task, true);
  return toPublicTask(task);
}

async function deleteTask(id, userId) {
  const row = await dbGetTaskRow(id);
  if (!row) throw createError('Task not found', 404);
  if (Number(row.user_id) !== Number(userId)) throw createError('Access denied', 403);

  const mem = tasks.get(String(id || ''));
  if (mem && typeof mem._abort === 'function') mem._abort();
  tasks.delete(String(id || ''));
  await dbRun('DELETE FROM downloader_tasks WHERE id = ? AND user_id = ?', [String(id || ''), userId]);
  return { id: String(id || '') };
}

async function pauseAllTasks(userId) {
  const rows = await dbAll(
    "SELECT * FROM downloader_tasks WHERE user_id = ? AND status IN ('queued','running') ORDER BY created_at DESC LIMIT 300",
    [userId]
  );

  const out = [];
  for (const row of rows) {
    const t = tasks.get(String(row.id)) || rowToTask(row);
    if (t.userId !== userId) continue;
    if (t.status === 'completed' || t.status === 'failed' || t.status === 'canceled') continue;
    t.status = 'paused';
    t.updatedAt = now();
    tasks.set(t.id, t);
    if (typeof t._abort === 'function') t._abort();
    await persistTaskThrottled(t, true);
    out.push(toPublicTask(t));
  }
  return out;
}

async function resumeAllTasks(userId) {
  const rows = await dbAll(
    "SELECT * FROM downloader_tasks WHERE user_id = ? AND status IN ('paused','failed') ORDER BY created_at DESC LIMIT 300",
    [userId]
  );

  const out = [];
  for (const row of rows) {
    const t = tasks.get(String(row.id)) || rowToTask(row);
    if (t.userId !== userId) continue;
    if (t.status === 'completed' || t.status === 'canceled') continue;
    t.status = 'queued';
    t.error = null;
    t.finishedAt = null;
    t.updatedAt = now();
    tasks.set(t.id, t);
    await persistTaskThrottled(t, true);
    enqueueTask(t);
    out.push(toPublicTask(t));
  }
  return out;
}

async function clearTasks(userId, statuses) {
  const allowed = new Set(['completed', 'failed', 'canceled', 'paused', 'queued']);
  const normalized = Array.isArray(statuses) && statuses.length
    ? statuses.map((s) => String(s || '')).filter((s) => allowed.has(s))
    : ['completed', 'failed', 'canceled'];

  const placeholders = normalized.map(() => '?').join(',');
  const rows = await dbAll(
    `SELECT id FROM downloader_tasks WHERE user_id = ? AND status IN (${placeholders})`,
    [userId, ...normalized]
  );

  for (const r of rows) {
    const id = String(r.id);
    const mem = tasks.get(id);
    if (mem && typeof mem._abort === 'function') mem._abort();
    tasks.delete(id);
  }

  const result = await dbRun(
    `DELETE FROM downloader_tasks WHERE user_id = ? AND status IN (${placeholders})`,
    [userId, ...normalized]
  );

  return { deleted: Number(result?.changes || 0), statuses: normalized };
}

void (async () => {
  const rows = await dbAll(
    "SELECT * FROM downloader_tasks WHERE status IN ('queued','running') ORDER BY created_at DESC LIMIT 50"
  ).catch(() => []);

  for (const row of rows) {
    const task = rowToTask(row);
    task.status = 'queued';
    task.updatedAt = now();
    tasks.set(task.id, task);
    trimTasksInMemory();
    enqueueTask(task);
    await persistTaskThrottled(task, true);
  }
})();

module.exports = {
  createDownloadTask,
  createM3u8ToMp4Task,
  getTask,
  listTasks,
  pauseTask,
  pauseAllTasks,
  resumeTask,
  resumeAllTasks,
  cancelTask,
  deleteTask,
  clearTasks,
  parseContentDispositionFilename,
  extractHlsUris
};
