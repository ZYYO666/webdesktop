const { ensure, createError } = require('../../utils/tooljs');
const crypto = require('crypto');
const util = require('util');
const { execFile, spawn } = require('child_process');
const { dbRun, dbGet, dbAll } = require('../../utils/db-utils');
const execFileAsync = util.promisify(execFile);

const docker = async (args, options = {}) => {
  return await execFileAsync('docker', args, {
    maxBuffer: 10 * 1024 * 1024,
    ...options
  });
};

const stripAnsi = (text) => {
  const s = String(text ?? '');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 27) {
      if (s[i + 1] === '[') {
        i += 1;
        while (i + 1 < s.length) {
          i += 1;
          const ch = s[i];
          if (ch >= '@' && ch <= '~') break;
        }
        continue;
      }
      continue;
    }
    out += s[i];
  }
  return out;
};

const extractExecErrText = (err, maxLen = 4000) => {
  const parts = [];
  const stderr = stripAnsi(err?.stderr).trim();
  const stdout = stripAnsi(err?.stdout).trim();
  const msg = stripAnsi(err?.message).trim();
  if (stderr) parts.push(stderr);
  if (stdout) parts.push(stdout);
  if (!stderr && !stdout && msg) parts.push(msg);
  const out = parts.join('\n').trim();
  if (!out) return '';
  return out.length > maxLen ? out.slice(0, maxLen) : out;
};

const shortenText = (text, maxLen = 600) => {
  const s = String(text ?? '').trim();
  if (!s) return '';
  return s.length > maxLen ? s.slice(0, maxLen) : s;
};

const classifyDockerUnavailable = (err) => {
  const msgRaw = extractExecErrText(err) || '';
  const msg = msgRaw.toLowerCase();
  if (err?.code === 'ENOENT' || msg.includes('spawn docker') || msg.includes('not found')) {
    return { status: 503, msg: '未找到 Docker（请安装 Docker）' };
  }
  if (err?.code === 'EACCES' || msg.includes('permission denied')) {
    return { status: 503, msg: 'Docker 权限不足（请检查权限或以管理员运行）' };
  }
  if (msg.includes('cannot connect to the docker daemon') || msg.includes('is the docker daemon running')) {
    return { status: 503, msg: '无法连接 Docker Daemon（请确认 Docker 已启动）' };
  }
  if (msg.includes('error during connect') || msg.includes('connection refused')) {
    return { status: 503, msg: 'Docker 连接失败（请确认 Docker 已启动）' };
  }
  if (msgRaw) return { status: 503, msg: shortenText(msgRaw, 180) };
  return { status: 503, msg: 'Docker 不可用' };
};

async function ensureDockerAvailable() {
  try {
    await docker(['version', '--format', '{{.Server.Version}}']);
    return { available: true, reason: '' };
  } catch (err) {
    const classified = classifyDockerUnavailable(err);
    return { available: false, reason: classified.msg };
  }
}

const isValidContainerRef = (ref) => {
  const s = String(ref || '').trim();
  if (!s) return false;
  if (/^[a-f0-9]{12,64}$/i.test(s)) return true;
  return /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(s);
};

const isValidImageRef = (ref) => {
  const s = String(ref || '').trim();
  if (!s || s.length > 300) return false;
  return /^(?:[a-z0-9.-]+(?::[0-9]{1,5})?\/)?[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*(?::[a-zA-Z0-9_.-]+)?(?:@sha256:[a-f0-9]{64})?$/i.test(s);
};

const parsePortPair = (raw) => {
  const s = String(raw || '').trim();
  const m = s.match(/^([0-9]{1,5}):([0-9]{1,5})$/);
  if (!m) return null;
  const host = Number(m[1]);
  const container = Number(m[2]);
  if (!Number.isInteger(host) || !Number.isInteger(container)) return null;
  if (host < 1 || host > 65535 || container < 1 || container > 65535) return null;
  return `${host}:${container}`;
};

const parseEnvList = (env) => {
  if (!env) return [];
  if (Array.isArray(env)) {
    return env
      .map((v) => String(v ?? '').trim())
      .filter(Boolean)
      .filter((pair) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(pair))
      .slice(0, 50);
  }
  if (typeof env === 'object') {
    const out = [];
    for (const [k, v] of Object.entries(env)) {
      const key = String(k ?? '').trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      const val = String(v ?? '');
      if (val.length > 2000) continue;
      out.push(`${key}=${val}`);
      if (out.length >= 50) break;
    }
    return out;
  }
  return [];
};

const parseLabelList = (labels) => {
  if (!labels) return [];
  const out = [];
  const pushPair = (kRaw, vRaw) => {
    const key = String(kRaw ?? '').trim();
    if (!key) return;
    if (!/^(?:[A-Za-z0-9][A-Za-z0-9_.-]{0,62})(?:\/[A-Za-z0-9][A-Za-z0-9_.-]{0,62})?$/.test(key)) return;
    const val = String(vRaw ?? '').replace(/\r?\n/g, ' ').trim();
    if (!val) return;
    out.push(`${key}=${val.length > 200 ? val.slice(0, 200) : val}`);
  };
  if (Array.isArray(labels)) {
    for (const it of labels) {
      const s = String(it ?? '').trim();
      if (!s) continue;
      const idx = s.indexOf('=');
      if (idx <= 0) continue;
      pushPair(s.slice(0, idx), s.slice(idx + 1));
      if (out.length >= 50) break;
    }
    return out;
  }
  if (typeof labels === 'object') {
    for (const [k, v] of Object.entries(labels)) {
      pushPair(k, v);
      if (out.length >= 50) break;
    }
    return out;
  }
  return [];
};

const parseDockerLabels = (raw) => {
  const text = String(raw ?? '').trim();
  if (!text) return {};
  const obj = {};
  for (const part of text.split(',')) {
    const s = String(part ?? '').trim();
    if (!s) continue;
    const idx = s.indexOf('=');
    if (idx <= 0) continue;
    const k = s.slice(0, idx).trim();
    const v = s.slice(idx + 1).trim();
    if (!k || !v) continue;
    obj[k] = v;
  }
  return obj;
};

const normalizeProjectKey = (input) => {
  const s = String(input ?? '').trim();
  if (!s) return 'global';
  if (s === '/') return '/';
  if (!s.startsWith('/')) return `/${s.replace(/\/+$/, '')}`;
  return s.replace(/\/+$/, '');
};

const safeProjectSuffix = (projectKey) => {
  const s = normalizeProjectKey(projectKey);
  if (s === 'global') return 'global';
  if (s === '/') return 'root';
  const base = s.split('/').filter(Boolean).pop() || 'project';
  const clean = base.replace(/[^a-zA-Z0-9_.-]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  if (clean && clean.length <= 40) return clean.toLowerCase();
  const hash = crypto.createHash('sha256').update(s).digest('hex').slice(0, 10);
  return `p-${hash}`;
};

const makeProjectContainerName = (baseName, projectKey) => {
  const base = String(baseName ?? '').trim();
  if (!base) return '';
  const key = normalizeProjectKey(projectKey);
  if (key === 'global') return base.slice(0, 128);
  const suffix = safeProjectSuffix(key);
  return `${base}-${suffix}`.slice(0, 128);
};

const parseVolume = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return null;
  const m = s.match(/^([^:\s]+):([^:\s]+)(?::(ro|rw))?$/);
  if (!m) return null;
  const hostPath = m[1];
  const containerPath = m[2];
  const mode = m[3];
  if (!hostPath.startsWith('/')) return null;
  if (!containerPath.startsWith('/')) return null;
  if (hostPath.includes('..') || containerPath.includes('..')) return null;
  const suffix = mode ? `:${mode}` : '';
  return `${hostPath}:${containerPath}${suffix}`;
};

async function listContainers() {
  const runtime = await ensureDockerAvailable();
  if (!runtime.available) return [];

  const out = await docker([
    'ps',
    '-a',
    '--format',
    '{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}\t{{.CreatedAt}}\t{{.Labels}}'
  ]).catch((err) => {
    const classified = classifyDockerUnavailable(err);
    throw createError(`获取容器列表失败: ${classified.msg}`, classified.status);
  });

  const stdout = String(out?.stdout || '');
  const lines = stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.map((line) => {
    const [id, name, image, status, ports, createdAt, labels] = line.split('\t');
    const statusText = String(status || '').trim();
    const running = statusText.toLowerCase().startsWith('up');
    const paused = /\(paused\)/i.test(statusText);
    return {
      id: String(id || '').trim(),
      name: String(name || '').trim(),
      image: String(image || '').trim(),
      status: statusText,
      ports: String(ports || '').trim(),
      createdAt: String(createdAt || '').trim(),
      running,
      paused,
      labels: parseDockerLabels(labels)
    };
  }).filter((c) => c.id && c.name);
}

async function getRuntime() {
  const docker = await ensureDockerAvailable();
  return { docker };
}

async function inspectContainer(refRaw) {
  ensure({ ref: refRaw });
  const ref = String(refRaw || '').trim();
  if (!isValidContainerRef(ref)) throw createError('Invalid container reference', 400);

  const runtime = await ensureDockerAvailable();
  if (!runtime.available) throw createError(runtime.reason || '失败', 503);

  const out = await docker(['inspect', ref]).catch((_err) => {
    const classified = classifyDockerUnavailable(_err);
    throw createError(classified.msg || '失败', classified.status);
  });
  const json = JSON.parse(String(out?.stdout || '[]'));
  return Array.isArray(json) ? (json[0] || null) : null;
}

async function containerAction(refRaw, actionRaw) {
  ensure({ ref: refRaw, action: actionRaw });
  const ref = String(refRaw || '').trim();
  const action = String(actionRaw || '').trim().toLowerCase();
  if (!isValidContainerRef(ref)) throw createError('Invalid container reference', 400);
  if (!['start', 'stop', 'restart', 'pause', 'unpause'].includes(action)) throw createError('Invalid action', 400);

  const runtime = await ensureDockerAvailable();
  if (!runtime.available) throw createError(runtime.reason || '失败', 503);

  await docker([action, ref]).catch((err) => {
    const detail = extractExecErrText(err);
    const msg = detail ? `容器操作失败: ${detail}` : '容器操作失败';
    throw createError(msg, 500);
  });
  return await listContainers();
}

async function removeContainer(refRaw, forceRaw) {
  ensure({ ref: refRaw });
  const ref = String(refRaw || '').trim();
  if (!isValidContainerRef(ref)) throw createError('Invalid container reference', 400);

  const runtime = await ensureDockerAvailable();
  if (!runtime.available) throw createError(runtime.reason || '失败', 503);

  const force = String(forceRaw || '').trim();
  const forceBool = force === '1' || force === 'true' || force === 'yes';
  const args = ['rm'];
  if (forceBool) args.push('-f');
  args.push(ref);

  await docker(args).catch((_err) => {
    const classified = classifyDockerUnavailable(_err);
    throw createError(`删除容器失败: ${classified.msg}`, classified.status);
  });
  return await listContainers();
}

async function containerLogs(refRaw, tailRaw) {
  ensure({ ref: refRaw });
  const ref = String(refRaw || '').trim();
  if (!isValidContainerRef(ref)) throw createError('Invalid container reference', 400);

  const runtime = await ensureDockerAvailable();
  if (!runtime.available) throw createError(runtime.reason || '失败', 503);

  const tailNum = Number(tailRaw ?? 200);
  const tail = Number.isFinite(tailNum) ? Math.max(1, Math.min(2000, Math.floor(tailNum))) : 200;

  const out = await docker(['logs', '--tail', String(tail), ref]).catch((_err) => {
    const classified = classifyDockerUnavailable(_err);
    throw createError(`获取日志失败: ${classified.msg}`, classified.status);
  });
  return { text: String(out?.stdout || '') };
}

async function containerStats(refRaw) {
  ensure({ ref: refRaw });
  const ref = String(refRaw || '').trim();
  if (!isValidContainerRef(ref)) throw createError('Invalid container reference', 400);

  const runtime = await ensureDockerAvailable();
  if (!runtime.available) throw createError(runtime.reason || '失败', 503);

  const out = await docker(['stats', '--no-stream', '--format', '{{json .}}', ref]).catch((err) => {
    const detail = extractExecErrText(err);
    const msg = detail ? `获取容器状态失败: ${detail}` : '获取容器状态失败';
    throw createError(msg, 500);
  });

  const line = String(out?.stdout || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)[0];
  if (!line) return null;

  try {
    return JSON.parse(line);
  } catch (_err) {
    return { raw: line };
  }
}

async function containerTop(refRaw) {
  ensure({ ref: refRaw });
  const ref = String(refRaw || '').trim();
  if (!isValidContainerRef(ref)) throw createError('Invalid container reference', 400);

  const runtime = await ensureDockerAvailable();
  if (!runtime.available) throw createError(runtime.reason || '失败', 503);

  const out = await docker(['top', ref]).catch((err) => {
    const detail = extractExecErrText(err);
    const msg = detail ? `获取进程列表失败: ${detail}` : '获取进程列表失败';
    throw createError(msg, 500);
  });

  return { text: String(out?.stdout || '') };
}

async function containerExec(refRaw, payload) {
  ensure({ ref: refRaw, payload });
  const ref = String(refRaw || '').trim();
  if (!isValidContainerRef(ref)) throw createError('Invalid container reference', 400);

  const cmd = String(payload?.cmd ?? '').trim();
  if (!cmd) throw createError('Invalid cmd', 400);
  if (cmd.length > 4000) throw createError('Cmd too long', 400);

  const runtime = await ensureDockerAvailable();
  if (!runtime.available) throw createError(runtime.reason || '失败', 503);

  const shellRaw = String(payload?.shell ?? 'sh').trim().toLowerCase();
  const shell = shellRaw === 'bash' ? 'bash' : 'sh';

  const workdir = payload?.workdir == null ? '' : String(payload.workdir).trim();
  if (workdir && (!workdir.startsWith('/') || workdir.includes('..') || workdir.length > 260)) {
    throw createError('Invalid workdir', 400);
  }

  const user = payload?.user == null ? '' : String(payload.user).trim();
  if (user && user.length > 80) throw createError('Invalid user', 400);

  const args = ['exec', '-i'];
  if (workdir) args.push('-w', workdir);
  if (user) args.push('-u', user);
  args.push(ref, shell, '-lc', cmd);

  const out = await docker(args, { maxBuffer: 20 * 1024 * 1024 }).catch((err) => {
    const detail = extractExecErrText(err);
    const msg = detail ? `执行失败: ${detail}` : '执行失败';
    throw createError(msg, 500);
  });

  return {
    stdout: String(out?.stdout || ''),
    stderr: String(out?.stderr || '')
  };
}

async function updateContainerLabels(refRaw, payload) {
  ensure({ ref: refRaw, payload });
  const ref = String(refRaw || '').trim();
  if (!isValidContainerRef(ref)) throw createError('Invalid container reference', 400);

  const adds = parseLabelList(payload?.add);
  const removeInput = Array.isArray(payload?.remove) ? payload.remove : [];
  const remove = removeInput
    .map((k) => String(k ?? '').trim())
    .filter(Boolean)
    .filter((k) => /^(?:[A-Za-z0-9][A-Za-z0-9_.-]{0,62})(?:\/[A-Za-z0-9][A-Za-z0-9_.-]{0,62})?$/.test(k))
    .slice(0, 50);

  if (!adds.length && !remove.length) throw createError('Empty labels update', 400);

  const runtime = await ensureDockerAvailable();
  if (!runtime.available) throw createError(runtime.reason || '失败', 503);

  const args = ['update'];
  for (const kv of adds) args.push('--label-add', kv);
  for (const k of remove) args.push('--label-rm', k);
  args.push(ref);

  await docker(args).catch((err) => {
    const detail = extractExecErrText(err);
    const msg = detail ? `更新标签失败: ${detail}` : '更新标签失败';
    throw createError(msg, 500);
  });

  return await listContainers();
}

async function recreateContainer(refRaw, payload) {
  ensure({ ref: refRaw, payload });
  const ref = String(refRaw || '').trim();
  if (!isValidContainerRef(ref)) throw createError('Invalid container reference', 400);

  const runtime = await ensureDockerAvailable();
  if (!runtime.available) throw createError(runtime.reason || '失败', 503);

  const image = String(payload?.image || '').trim();
  const name = payload?.name == null ? '' : String(payload?.name).trim();
  const portsInput = Array.isArray(payload?.ports) ? payload.ports : [];
  const volumesInput = Array.isArray(payload?.volumes) ? payload.volumes : [];
  const envPairs = parseEnvList(payload?.env);
  const labelPairs = parseLabelList(payload?.labels);

  if (!isValidImageRef(image)) throw createError('Invalid image', 400);
  if (name && !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(name)) throw createError('Invalid container name', 400);

  const ports = portsInput.map(parsePortPair).filter(Boolean).slice(0, 30);
  const volumes = volumesInput.map(parseVolume).filter(Boolean).slice(0, 30);

  const stopErr = await docker(['stop', ref]).catch((err) => err);
  if (stopErr) {
    const detail = extractExecErrText(stopErr);
    if (detail && !detail.toLowerCase().includes('not running')) {
      throw createError(`停止容器失败: ${detail}`, 500);
    }
  }

  await docker(['rm', '-f', ref]).catch((err) => {
    const detail = extractExecErrText(err);
    const msg = detail ? `删除旧容器失败: ${detail}` : '删除旧容器失败';
    throw createError(msg, 500);
  });

  const args = ['run', '-d'];
  if (name) args.push('--name', name);
  for (const l of labelPairs) args.push('--label', l);
  for (const p of ports) args.push('-p', p);
  for (const e of envPairs) args.push('-e', e);
  for (const v of volumes) args.push('-v', v);
  args.push(image);

  const out = await docker(args).catch((err) => {
    const detail = extractExecErrText(err);
    const msg = detail ? `重建启动失败: ${detail}` : '重建启动失败';
    throw createError(msg, 500);
  });

  const containerId = String(out?.stdout || '').trim();
  const containers = await listContainers();
  return { containerId, containers };
}

async function listImages() {
  const runtime = await ensureDockerAvailable();
  if (!runtime.available) return [];

  const out = await docker([
    'images',
    '--format',
    '{{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}\t{{.CreatedSince}}'
  ]).catch((err) => {
    const classified = classifyDockerUnavailable(err);
    throw createError(`获取镜像列表失败: ${classified.msg}`, classified.status);
  });

  const stdout = String(out?.stdout || '');
  const lines = stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.map((line) => {
    const [repository, tag, id, size, createdSince] = line.split('\t');
    return {
      repository: String(repository || '').trim(),
      tag: String(tag || '').trim(),
      id: String(id || '').trim(),
      size: String(size || '').trim(),
      createdSince: String(createdSince || '').trim()
    };
  }).filter((i) => i.id);
}

async function pullImage(imageRaw) {
  ensure({ image: imageRaw });
  const image = String(imageRaw || '').trim();
  if (!isValidImageRef(image)) throw createError('Invalid image', 400);

  const runtime = await ensureDockerAvailable();
  if (!runtime.available) throw createError(runtime.reason || '失败', 503);

  await docker(['pull', image]).catch((_err) => {
    const classified = classifyDockerUnavailable(_err);
    throw createError(`拉取镜像失败: ${classified.msg}`, classified.status);
  });
  return { image };
}

async function runContainer(payload) {
  ensure({ payload });
  const image = String(payload?.image || '').trim();
  const name = payload?.name == null ? '' : String(payload?.name).trim();
  const portsInput = Array.isArray(payload?.ports) ? payload.ports : [];
  const volumesInput = Array.isArray(payload?.volumes) ? payload.volumes : [];
  const envPairs = parseEnvList(payload?.env);
  const labelPairs = parseLabelList(payload?.labels);

  if (!isValidImageRef(image)) throw createError('Invalid image', 400);
  if (name && !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(name)) throw createError('Invalid container name', 400);

  const ports = portsInput.map(parsePortPair).filter(Boolean).slice(0, 30);
  const volumes = volumesInput.map(parseVolume).filter(Boolean).slice(0, 30);

  const runtime = await ensureDockerAvailable();
  if (!runtime.available) throw createError(runtime.reason || '失败', 503);

  const args = ['run', '-d'];
  if (name) args.push('--name', name);
  for (const l of labelPairs) args.push('--label', l);
  for (const p of ports) args.push('-p', p);
  for (const e of envPairs) args.push('-e', e);
  for (const v of volumes) args.push('-v', v);
  args.push(image);

  const out = await docker(args).catch((err) => {
    const detail = extractExecErrText(err);
    const msg = detail ? `启动容器失败: ${detail}` : '启动容器失败';
    throw createError(msg, 500);
  });

  const containerId = String(out?.stdout || '').trim();
  return { containerId };
}

const INSTALL_TEMPLATES = [
  {
    id: 'jellyfin',
    name: 'Jellyfin 媒体中心',
    description: '家庭影音库管理与在线播放',
    tags: ['影音', '媒体'],
    image: 'jellyfin/jellyfin:latest',
    defaultName: 'jellyfin',
    ports: ['8096:8096'],
    env: [],
    volumes: []
  },
  {
    id: 'navidrome',
    name: 'Navidrome 音乐库',
    description: '轻量音乐流媒体服务',
    tags: ['音乐', '媒体'],
    image: 'deluan/navidrome:latest',
    defaultName: 'navidrome',
    ports: ['4533:4533'],
    env: [],
    volumes: []
  },
  {
    id: 'freshrss',
    name: 'FreshRSS 阅读器',
    description: '自建 RSS 阅读与收藏',
    tags: ['阅读', '资讯'],
    image: 'freshrss/freshrss:latest',
    defaultName: 'freshrss',
    ports: ['8083:80'],
    env: [],
    volumes: []
  },
  {
    id: 'vaultwarden',
    name: 'Vaultwarden 密码库',
    description: '自建密码管理服务（Bitwarden 兼容）',
    tags: ['安全', '工具'],
    image: 'vaultwarden/server:latest',
    defaultName: 'vaultwarden',
    ports: ['8089:80'],
    env: [],
    volumes: []
  },
  {
    id: 'homepage',
    name: 'Homepage 仪表盘',
    description: '家庭/团队服务入口页',
    tags: ['仪表盘', '主页'],
    image: 'ghcr.io/gethomepage/homepage:latest',
    defaultName: 'homepage',
    ports: ['3002:3000'],
    env: [],
    volumes: []
  },
  {
    id: 'portainer',
    name: 'Portainer 容器面板',
    description: 'Docker 管理面板（可选）',
    tags: ['容器', '面板'],
    image: 'portainer/portainer-ce:latest',
    defaultName: 'portainer',
    ports: ['9000:9000'],
    env: [],
    volumes: []
  },
  {
    id: 'filebrowser',
    name: 'File Browser 文件管理',
    description: '轻量 Web 文件管理器',
    tags: ['文件', '管理'],
    image: 'filebrowser/filebrowser:latest',
    defaultName: 'filebrowser',
    ports: ['8088:80'],
    env: [],
    volumes: []
  },
  {
    id: 'uptime-kuma',
    name: 'Uptime Kuma 监控',
    description: '站点/服务可用性监控',
    tags: ['监控', '告警'],
    image: 'louislam/uptime-kuma:latest',
    defaultName: 'uptime-kuma',
    ports: ['3003:3001'],
    env: [],
    volumes: []
  },
  {
    id: 'gitea',
    name: 'Gitea 代码托管',
    description: '轻量 Git 服务（可选）',
    tags: ['代码', '协作'],
    image: 'gitea/gitea:latest',
    defaultName: 'gitea',
    ports: ['3004:3000'],
    env: [],
    volumes: []
  },
  {
    id: 'minio',
    name: 'MinIO 对象存储',
    description: 'S3 兼容对象存储（可选）',
    tags: ['存储', 'S3'],
    image: 'minio/minio:latest',
    defaultName: 'minio',
    ports: ['9001:9000', '9002:9001'],
    env: [],
    volumes: []
  },
  {
    id: 'metabase',
    name: 'Metabase 可视化',
    description: '零配置数据可视化与仪表盘',
    tags: ['可视化', '仪表盘'],
    image: 'metabase/metabase:latest',
    defaultName: 'metabase',
    ports: ['3001:3000'],
    env: [],
    volumes: []
  }
];

const now = () => Date.now();

const JOB_STATUSES = new Set(['queued', 'running', 'success', 'failed', 'canceled']);
const STEP_LABELS = new Set(['prepare', 'pull', 'run', 'done']);

const jobs = new Map();
const queue = [];
let pumping = false;

const normalizeJob = (row) => {
  const rawStatus = String(row?.status || '').trim().toLowerCase();
  const status = rawStatus === 'cancelled' ? 'canceled' : (JOB_STATUSES.has(rawStatus) ? rawStatus : 'queued');
  const rawStep = String(row?.step || '').trim().toLowerCase();
  const step = STEP_LABELS.has(rawStep) ? rawStep : 'prepare';
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
    templateId: row.template_id ? String(row.template_id) : null,
    status,
    step,
    progress: Number(row.progress || 0),
    createdAt: Number(row.created_at || now()),
    updatedAt: Number(row.updated_at || now()),
    error: row.error ? String(row.error) : null,
    logs: row.logs ? String(row.logs) : '',
    meta: meta && typeof meta === 'object' ? meta : null,
    _proc: null,
    _persistAt: 0
  };
};

const toPublicJob = (job) => {
  return {
    id: job.id,
    templateId: job.templateId,
    status: job.status,
    step: job.step,
    progress: job.progress,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    error: job.error,
    logs: job.logs,
    meta: job.meta
  };
};

const getJobProjectKey = (job) => {
  const key = job?.meta?.projectKey ?? job?.meta?.project_path ?? job?.meta?.projectPath;
  return normalizeProjectKey(key);
};

const findInstalledContainer = async ({ templateId, projectKey }) => {
  const runtime = await ensureDockerAvailable();
  if (!runtime.available) return null;
  const t = String(templateId || '').trim();
  if (!t) return null;
  const p = normalizeProjectKey(projectKey);
  const out = await docker([
    'ps',
    '-a',
    '--filter',
    `label=app_store.template_id=${t}`,
    '--filter',
    `label=app_store.project_key=${p}`,
    '--format',
    '{{.ID}}\t{{.Names}}'
  ]).catch(() => null);
  const stdout = String(out?.stdout || '').trim();
  if (!stdout) return null;
  const first = stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0] || '';
  if (!first) return null;
  const [id, name] = first.split('\t');
  const cid = String(id || '').trim();
  const cname = String(name || '').trim();
  if (!cid || !cname) return null;
  return { id: cid, name: cname };
};

const findContainerByName = async (name) => {
  const runtime = await ensureDockerAvailable();
  if (!runtime.available) return null;
  const n = String(name || '').trim();
  if (!n) return null;
  const out = await docker([
    'ps',
    '-a',
    '--filter',
    `name=^/${n}$`,
    '--format',
    '{{.ID}}\t{{.Names}}'
  ]).catch(() => null);
  const stdout = String(out?.stdout || '').trim();
  if (!stdout) return null;
  const first = stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0] || '';
  if (!first) return null;
  const [id, cname] = first.split('\t');
  const cid = String(id || '').trim();
  const nm = String(cname || '').trim();
  if (!cid || !nm) return null;
  return { id: cid, name: nm };
};

async function dbUpsertJob(job) {
  await dbRun(
    `INSERT INTO app_store_jobs
      (id, user_id, template_id, status, step, progress, created_at, updated_at, error, logs, meta)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        template_id=excluded.template_id,
        status=excluded.status,
        step=excluded.step,
        progress=excluded.progress,
        updated_at=excluded.updated_at,
        error=excluded.error,
        logs=excluded.logs,
        meta=excluded.meta`,
    [
      job.id,
      job.userId,
      job.templateId,
      job.status,
      job.step,
      Number(job.progress || 0),
      Number(job.createdAt || now()),
      Number(job.updatedAt || now()),
      job.error || null,
      job.logs || '',
      job.meta ? JSON.stringify(job.meta) : null
    ]
  );
}

async function dbGetJobRow(id) {
  return await dbGet('SELECT * FROM app_store_jobs WHERE id = ?', [String(id || '')]);
}

async function dbListJobRows(userId, limit = 30) {
  return await dbAll(
    'SELECT * FROM app_store_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [Number(userId), Math.max(1, Math.min(100, limit))]
  );
}

async function dbListActiveJobRows(userId, templateId) {
  return await dbAll(
    "SELECT * FROM app_store_jobs WHERE user_id = ? AND template_id = ? AND status IN ('queued','running') ORDER BY created_at DESC LIMIT 50",
    [Number(userId), String(templateId || '')]
  );
}

async function persistJobThrottled(job) {
  const at = now();
  if (at - Number(job._persistAt || 0) < 500) return;
  job._persistAt = at;
  await dbUpsertJob(job);
}

const isTerminalStatus = (status) => {
  const s = String(status || '').trim().toLowerCase();
  return s === 'success' || s === 'failed' || s === 'canceled';
};

const pushJobLog = (job, text) => {
  const line = String(text ?? '').trimEnd();
  if (!line) return;
  const next = job.logs ? `${job.logs}\n${line}` : line;
  job.logs = next.length > 200_000 ? next.slice(-200_000) : next;
  job.updatedAt = now();
};

const setJobState = async (job, patch) => {
  if (job.status === 'canceled') {
    if (patch?.status && patch.status !== 'canceled') return;
    if (!patch?.status) return;
  }
  Object.assign(job, patch);
  job.updatedAt = now();
  if (isTerminalStatus(job.status) || job.step === 'done') {
    job._persistAt = now();
    await dbUpsertJob(job);
    return;
  }
  await persistJobThrottled(job);
};

const enqueueJob = (job) => {
  if (!queue.includes(job.id)) queue.push(job.id);
  schedulePump();
};

let pumpTimer = null;
const schedulePump = () => {
  if (pumpTimer) return;
  pumpTimer = setTimeout(() => {
    pumpTimer = null;
    void pumpQueue();
  }, 20);
};

const runDockerPullWithLogs = (image, job) => {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['pull', image], { stdio: ['ignore', 'pipe', 'pipe'] });
    job._proc = child;
    let settled = false;
    const idleTimeoutMs = 5 * 60 * 1000;
    const totalTimeoutMs = 30 * 60 * 1000;
    let idleTimer = null;
    let totalTimer = null;

    const cleanup = () => {
      if (idleTimer) clearTimeout(idleTimer);
      if (totalTimer) clearTimeout(totalTimer);
      idleTimer = null;
      totalTimer = null;
    };

    const settleResolve = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };

    const settleReject = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (job.status === 'canceled') {
          try {
            child.kill('SIGTERM');
          } catch {
            void 0;
          }
          return settleResolve();
        }
        const msg = `docker pull 无输出超过 ${Math.floor(idleTimeoutMs / 1000)}s，判定卡死`;
        pushJobLog(job, msg);
        try {
          child.kill('SIGTERM');
        } catch {
          void 0;
        }
        const e = new Error(msg);
        e._appStoreLogged = true;
        settleReject(e);
      }, idleTimeoutMs);
    };

    totalTimer = setTimeout(() => {
      if (job.status === 'canceled') {
        try {
          child.kill('SIGTERM');
        } catch {
          void 0;
        }
        return settleResolve();
      }
      const msg = `docker pull 超时超过 ${Math.floor(totalTimeoutMs / 1000)}s`;
      pushJobLog(job, msg);
      try {
        child.kill('SIGTERM');
      } catch {
        void 0;
      }
      const e = new Error(msg);
      e._appStoreLogged = true;
      settleReject(e);
    }, totalTimeoutMs);
    resetIdleTimer();

    const onLine = (chunk) => {
      const text = String(chunk ?? '');
      const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
      for (const l of lines) pushJobLog(job, l);
      void persistJobThrottled(job);
      resetIdleTimer();
    };

    if (child.stdout) child.stdout.on('data', onLine);
    if (child.stderr) child.stderr.on('data', onLine);

    child.on('error', (err) => {
      job._proc = null;
      settleReject(err);
    });

    child.on('close', (code, signal) => {
      job._proc = null;
      if (settled) return;
      if (job.status === 'canceled') return settleResolve();
      if (code === 0) return settleResolve();
      const extra = signal ? ` signal=${signal}` : '';
      settleReject(new Error(`docker pull exited with code ${code}${extra}`));
    });
  });
};

async function pumpQueue() {
  if (pumping) return;
  pumping = true;
  try {
    while (queue.length) {
      const id = queue.shift();
      const job = id ? jobs.get(id) : null;
      if (!job) continue;
      if (job.status !== 'queued') continue;

      const runtime = await ensureDockerAvailable();
      if (!runtime.available) {
        const msg = runtime.reason || 'Docker 不可用';
        pushJobLog(job, msg);
        await setJobState(job, { status: 'failed', step: 'done', progress: 0, error: shortenText(msg) || '失败' });
        continue;
      }

      try {
        await setJobState(job, { status: 'running', step: 'pull', progress: 5, error: null });
        const image = String(job.meta?.image || '').trim();
        if (!isValidImageRef(image)) throw createError('Invalid image', 400);
        await runDockerPullWithLogs(image, job);
        if (job.status === 'canceled') continue;
        await setJobState(job, { step: 'run', progress: 70 });
        if (job.status === 'canceled') continue;

        const runPayload = job.meta?.run && typeof job.meta.run === 'object' ? job.meta.run : {};
        const replace = job.meta?.replaceExisting === true;
        const name = runPayload?.name ? String(runPayload.name).trim() : '';
        if (replace && name) {
          await docker(['rm', '-f', name]).catch(() => null);
        }

        const started = await runContainer(runPayload);
        if (job.status === 'canceled') continue;
        const inspected = await inspectContainer(started.containerId).catch(() => null);
        const containerRunning = !!inspected?.State?.Running;
        const containerStatus = inspected?.State?.Status ? String(inspected.State.Status) : '';
        const containerExitCode = Number.isFinite(inspected?.State?.ExitCode) ? Number(inspected.State.ExitCode) : null;
        const containerStateErr = inspected?.State?.Error ? String(inspected.State.Error).trim() : '';

        if (!containerRunning) {
          pushJobLog(job, '容器已创建，但未运行');
          const stateLine = [
            containerStatus ? `状态: ${containerStatus}` : '',
            containerExitCode != null ? `exitCode=${containerExitCode}` : ''
          ].filter(Boolean).join(' ');
          if (stateLine) pushJobLog(job, stateLine);
          if (containerStateErr) pushJobLog(job, containerStateErr);
          const logs = await containerLogs(started.containerId, 200).catch(() => null);
          const logText = String(logs?.text || '').trimEnd();
          if (logText) pushJobLog(job, logText.length > 8000 ? logText.slice(-8000) : logText);
        }

        await setJobState(job, {
          status: 'success',
          step: 'done',
          progress: 100,
          error: null,
          meta: {
            ...(job.meta || {}),
            containerId: started.containerId,
            containerName: name || null,
            containerRunning,
            containerState: {
              status: containerStatus || null,
              exitCode: containerExitCode,
              error: containerStateErr || null
            }
          }
        });
      } catch (err) {
        if (job.status === 'canceled') continue;
        const msg = shortenText(err?.message || extractExecErrText(err) || '失败');
        if (!err?._appStoreLogged) pushJobLog(job, msg || '失败');
        const projectKey = getJobProjectKey(job);
        const installed = await findInstalledContainer({ templateId: job.templateId, projectKey }).catch(() => null);
        if (installed?.id) {
          pushJobLog(job, '检测到容器已创建，任务改为成功');
          const inspected = await inspectContainer(installed.id).catch(() => null);
          const containerRunning = !!inspected?.State?.Running;
          const containerStatus = inspected?.State?.Status ? String(inspected.State.Status) : '';
          const containerExitCode = Number.isFinite(inspected?.State?.ExitCode) ? Number(inspected.State.ExitCode) : null;
          const containerStateErr = inspected?.State?.Error ? String(inspected.State.Error).trim() : '';

          if (!containerRunning) {
            pushJobLog(job, '容器已创建，但未运行');
            const stateLine = [
              containerStatus ? `状态: ${containerStatus}` : '',
              containerExitCode != null ? `exitCode=${containerExitCode}` : ''
            ].filter(Boolean).join(' ');
            if (stateLine) pushJobLog(job, stateLine);
            if (containerStateErr) pushJobLog(job, containerStateErr);
            const logs = await containerLogs(installed.id, 200).catch(() => null);
            const logText = String(logs?.text || '').trimEnd();
            if (logText) pushJobLog(job, logText.length > 8000 ? logText.slice(-8000) : logText);
          }

          await setJobState(job, {
            status: 'success',
            step: 'done',
            progress: 100,
            error: null,
            meta: {
              ...(job.meta || {}),
              containerId: installed.id,
              containerName: installed.name || null,
              containerRunning,
              containerState: {
                status: containerStatus || null,
                exitCode: containerExitCode,
                error: containerStateErr || null
              }
            }
          });
          continue;
        }
        await setJobState(job, {
          status: 'failed',
          step: 'done',
          progress: Math.min(99, Math.max(0, job.progress || 0)),
          error: msg || '失败'
        });
      }
    }
  } finally {
    pumping = false;
  }
}

async function listTemplates() {
  return INSTALL_TEMPLATES;
}

async function createInstallJob(userId, templateIdRaw, overrides) {
  ensure({ userId, templateId: templateIdRaw });
  const templateId = String(templateIdRaw || '').trim();
  const tpl = INSTALL_TEMPLATES.find((t) => String(t.id) === templateId) || null;
  if (!tpl) throw createError('Template not found', 404);

  const projectKey = normalizeProjectKey(overrides?.projectKey ?? overrides?.projectPath ?? overrides?.project_path);
  const wantReplace = overrides?.replaceExisting === true;
  const explicitName = overrides?.name == null ? '' : String(overrides.name).trim();
  const baseName = tpl.defaultName ? String(tpl.defaultName).trim() : String(tpl.id);

  const activeRows = await dbListActiveJobRows(userId, tpl.id).catch(() => []);
  for (const row of activeRows) {
    const activeJob = normalizeJob(row);
    if (getJobProjectKey(activeJob) !== projectKey) continue;
    throw createError('该项目已有安装任务进行中', 409);
  }

  let installed = await findInstalledContainer({ templateId: tpl.id, projectKey });
  const derivedName = explicitName || makeProjectContainerName(baseName, projectKey);
  if (!installed && derivedName) {
    installed = await findContainerByName(derivedName);
  }
  if (installed && !wantReplace) throw createError(`该项目已安装（容器：${installed.name}）`, 409);
  const name = installed && wantReplace ? installed.name : derivedName;
  const ports = Array.isArray(overrides?.ports) ? overrides.ports : tpl.ports;
  const volumes = Array.isArray(overrides?.volumes) ? overrides.volumes : tpl.volumes;
  const env = overrides?.env != null ? overrides.env : tpl.env;

  const runPayload = {
    image: tpl.image,
    ...(name ? { name } : {}),
    ...(ports && ports.length ? { ports } : {}),
    ...(volumes && volumes.length ? { volumes } : {}),
    ...(env != null ? { env } : {}),
    labels: {
      'app_store.template_id': String(tpl.id),
      'app_store.project_key': String(projectKey)
    }
  };

  const id = crypto.randomUUID();
  const job = {
    id,
    userId: Number(userId),
    templateId: tpl.id,
    status: 'queued',
    step: 'prepare',
    progress: 0,
    createdAt: now(),
    updatedAt: now(),
    error: null,
    logs: '',
    meta: {
      image: tpl.image,
      replaceExisting: wantReplace,
      projectKey,
      run: runPayload
    },
    _proc: null,
    _persistAt: 0
  };

  jobs.set(id, job);
  await dbUpsertJob(job);
  enqueueJob(job);
  return toPublicJob(job);
}

async function listInstallJobs(userId, limit, projectKeyRaw) {
  ensure({ userId });
  const projectKey = projectKeyRaw == null ? '' : normalizeProjectKey(projectKeyRaw);
  const rows = await dbListJobRows(userId, limit);
  const all = rows.map((r) => {
    const mem = r?.id ? jobs.get(String(r.id)) : null;
    if (mem) return toPublicJob(mem);
    return toPublicJob(normalizeJob(r));
  });
  if (!projectKeyRaw) return all;
  return all.filter((j) => getJobProjectKey(j) === projectKey);
}

async function getInstallJob(userId, idRaw) {
  ensure({ userId, id: idRaw });
  const id = String(idRaw || '').trim();
  const inMem = jobs.get(id) || null;
  if (inMem) {
    if (Number(inMem.userId) !== Number(userId)) throw createError('Forbidden', 403);
    return toPublicJob(inMem);
  }
  const row = await dbGetJobRow(id);
  if (!row) throw createError('Job not found', 404);
  const job = normalizeJob(row);
  if (Number(job.userId) !== Number(userId)) throw createError('Forbidden', 403);
  return toPublicJob(job);
}

async function cancelInstallJob(userId, idRaw) {
  ensure({ userId, id: idRaw });
  const id = String(idRaw || '').trim();
  const row = await dbGetJobRow(id);
  if (!row) throw createError('Job not found', 404);
  const job = jobs.get(id) || normalizeJob(row);
  if (Number(job.userId) !== Number(userId)) throw createError('Forbidden', 403);

  if (job.status === 'running' || job.status === 'queued') {
    if (job._proc && typeof job._proc.kill === 'function') {
      try {
        job._proc.kill('SIGTERM');
      } catch {
        void 0;
      }
      job._proc = null;
    }
    job.status = 'canceled';
    job.step = 'done';
    job.error = null;
    job.updatedAt = now();
    await dbUpsertJob(job);
  }
  return toPublicJob(job);
}

const removeFromQueue = (jobId) => {
  const id = String(jobId || '');
  if (!id) return;
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i] === id) queue.splice(i, 1);
  }
};

async function deleteInstallJob(userId, idRaw) {
  ensure({ userId, id: idRaw });
  const id = String(idRaw || '').trim();
  const row = await dbGetJobRow(id);
  if (!row) throw createError('Job not found', 404);
  const job = jobs.get(id) || normalizeJob(row);
  if (Number(job.userId) !== Number(userId)) throw createError('Forbidden', 403);

  if (job.status === 'running' || job.status === 'queued') {
    await cancelInstallJob(userId, id);
  }

  removeFromQueue(id);
  jobs.delete(id);
  await dbRun('DELETE FROM app_store_jobs WHERE id = ? AND user_id = ?', [id, Number(userId)]);
  return { id };
}

void (async () => {
  await dbRun(`CREATE TABLE IF NOT EXISTS app_store_jobs (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    template_id TEXT,
    status TEXT NOT NULL,
    step TEXT NOT NULL,
    progress INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    error TEXT,
    logs TEXT,
    meta TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`).catch(() => null);

  const rows = await dbAll(
    "SELECT * FROM app_store_jobs WHERE status IN ('queued','running') ORDER BY created_at DESC LIMIT 50"
  ).catch(() => []);
  for (const row of rows) {
    const job = normalizeJob(row);
    if (job.status === 'running') job.status = 'queued';
    job.updatedAt = now();
    jobs.set(job.id, job);
    enqueueJob(job);
    await dbUpsertJob(job).catch(() => null);
  }
})();

module.exports = {
  getRuntime,
  listContainers,
  inspectContainer,
  containerAction,
  removeContainer,
  containerLogs,
  containerStats,
  containerTop,
  containerExec,
  updateContainerLabels,
  recreateContainer,
  listImages,
  pullImage,
  runContainer,
  listTemplates,
  createInstallJob,
  listInstallJobs,
  getInstallJob,
  cancelInstallJob,
  deleteInstallJob
};
