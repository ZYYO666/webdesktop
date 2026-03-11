const safeJsonStringify = (value, maxLen = 4000) => {
  try {
    const redact = new Set(['password', 'token', 'authorization', 'auth', 'current_token']);
    const json = JSON.stringify(value, (k, v) => {
      if (k && redact.has(String(k).toLowerCase())) return '[REDACTED]';
      if (typeof v === 'string' && v.length > 1000) return `${v.slice(0, 1000)}…`;
      if (Array.isArray(v) && v.length > 50) return [...v.slice(0, 50), `…(${v.length - 50})`];
      return v;
    });
    if (!json) return null;
    if (json.length <= maxLen) return json;
    return `${json.slice(0, maxLen)}…`;
  } catch {
    return null;
  }
};

const defaultInferActionFrom = (methodInput, pathInput) => {
  const method = String(methodInput || '').toUpperCase();
  const p = String(pathInput || '');

  if (p === '/api/auth/login' && method === 'POST') return '登录';
  if (p === '/api/auth/register' && method === 'POST') return '注册';
  if (p === '/api/auth/logout' && method === 'POST') return '退出登录';
  if (p === '/api/list' && method === 'GET') return '浏览目录';
  if (p === '/api/search' && method === 'GET') return '搜索文件';
  if (p === '/api/file' && method === 'GET') return '读取文件';
  if (p === '/api/thumb' && method === 'GET') return '获取缩略图';
  if (p === '/api/stat' && method === 'GET') return '获取属性';
  if (p === '/api/mkdir' && method === 'POST') return '新建文件夹';
  if (p === '/api/upload' && method === 'POST') return '上传文件';
  if (p === '/api/rename' && method === 'POST') return '重命名';
  if (p === '/api/delete' && method === 'POST') return '删除';
  if (p === '/api/restore' && method === 'POST') return '从回收站恢复';
  if (p === '/api/move' && method === 'POST') return '移动';
  if (p === '/api/copy' && method === 'POST') return '复制';
  if (p === '/api/compress' && method === 'POST') return '压缩';
  if (p === '/api/extract' && method === 'POST') return '解压';
  if (p === '/api/save' && method === 'POST') return '保存文件';
  if (p.startsWith('/api/favorites') && method === 'POST') return '收藏操作';
  if (p.startsWith('/api/mounts') && method === 'POST') return '新增挂载点';
  if (p.startsWith('/api/mounts') && method === 'PUT') return '更新挂载点';
  if (p.startsWith('/api/mounts') && method === 'DELETE') return '删除挂载点';
  if (p.startsWith('/api/shares') && method === 'POST') return '创建分享链接';
  if (p.startsWith('/api/shares') && method === 'DELETE') return '删除分享链接';
  if (p.startsWith('/api/settings') && method === 'POST') return '更新设置';
  if (p === '/api/settings/clear-cache' && method === 'POST') return '清空缓存';
  if (p.startsWith('/api/users') && method === 'POST') return '创建用户';
  if (p.startsWith('/api/users') && method === 'PUT') return '更新用户';
  if (p.startsWith('/api/users') && method === 'DELETE') return '删除用户';
  if (p === '/api/task-manager/stats' && method === 'GET') return '查看系统监控';
  if (p.startsWith('/api/terminal') && method === 'POST') return '终端操作';
  if (p.startsWith('/api/terminal') && method === 'GET') return '终端读取';

  return '';
};

const createRequestLogger = ({ db, inferActionFrom = defaultInferActionFrom }) => {
  if (!db || typeof db.run !== 'function') {
    throw new Error('createRequestLogger requires a sqlite db with .run');
  }

  return (req, res, next) => {
    const p = String(req.path || '');
    const shouldLog = req.method !== 'OPTIONS' && (p.startsWith('/api') || p.startsWith('/s')) && !p.startsWith('/api/logs');
    if (!shouldLog) return next();

    const startNs = process.hrtime.bigint();
    const startedAt = Date.now();

    const reqBody =
      req.method === 'GET' || req.method === 'HEAD'
        ? null
        : req.is('application/json')
          ? safeJsonStringify(req.body)
          : null;

    res.on('finish', () => {
      const durationMs = Number((process.hrtime.bigint() - startNs) / BigInt(1e6));
      const ipRaw = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
      const ip = Array.isArray(ipRaw) ? ipRaw[0] : String(ipRaw).split(',')[0].trim();
      const userAgent = String(req.headers['user-agent'] || '');
      const userId = req.user?.id ?? null;
      const userRole = req.user?.role ?? (userId ? null : 'guest');
      const action = inferActionFrom(req.method, p);
      const query = Object.keys(req.query || {}).length ? safeJsonStringify(req.query, 2000) : null;
      const resSizeHeader = res.getHeader('content-length');
      const resSize = Number.isFinite(Number(resSizeHeader)) ? Number(resSizeHeader) : null;
      const errorTextRaw = res.locals && res.locals.__reqLogError ? String(res.locals.__reqLogError) : '';
      const errorText = errorTextRaw ? errorTextRaw.slice(0, 1000) : null;

      db.run(
        `INSERT INTO request_logs
          (ts, method, path, query, status, duration_ms, ip, user_agent, user_id, user_role, action, req_body, res_size, error)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          startedAt,
          String(req.method || ''),
          p,
          query,
          res.statusCode,
          durationMs,
          ip || null,
          userAgent || null,
          userId,
          userRole,
          action || null,
          reqBody,
          resSize,
          errorText
        ],
        () => void 0
      );
    });

    next();
  };
};

module.exports = { createRequestLogger };
