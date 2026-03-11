const createHttpError = require('http-errors');
const path = require('path');

const createError = (message, status) => {
  if (status) {
    return createHttpError(status, message);
  }
  return createHttpError(message);
};

const defaultInferActionFrom = (methodInput, pathInput) => {
  const method = String(methodInput || '').toUpperCase();
  const p = String(pathInput || '');

  const actionMap = {
    'POST:/api/auth/login': '登录',
    'POST:/api/auth/register': '注册',
    'POST:/api/auth/logout': '退出登录',
    'GET:/api/list': '浏览目录',
    'GET:/api/search': '搜索文件',
    'GET:/api/file': '读取文件',
    'GET:/api/thumb': '获取缩略图',
    'GET:/api/stat': '获取属性',
    'POST:/api/mkdir': '新建文件夹',
    'POST:/api/upload': '上传文件',
    'POST:/api/rename': '重命名',
    'POST:/api/delete': '删除',
    'POST:/api/restore': '从回收站恢复',
    'POST:/api/move': '移动',
    'POST:/api/copy': '复制',
    'POST:/api/compress': '压缩',
    'POST:/api/extract': '解压',
    'POST:/api/save': '保存文件',
    'POST:/api/settings/clear-cache': '清空缓存',
    'GET:/api/task-manager/stats': '查看系统监控'
  };

  const key = `${method}:${p}`;
  if (actionMap[key]) return actionMap[key];

  if (p.startsWith('/api/favorites') && method === 'POST') return '收藏操作';
  if (p.startsWith('/api/mounts')) {
    if (method === 'POST') return '新增挂载点';
    if (method === 'PUT') return '更新挂载点';
    if (method === 'DELETE') return '删除挂载点';
  }
  if (p.startsWith('/api/shares')) {
    if (method === 'POST') return '创建分享链接';
    if (method === 'DELETE') return '删除分享链接';
  }
  if (p.startsWith('/api/settings') && method === 'POST') return '更新设置';
  if (p.startsWith('/api/users')) {
    if (method === 'POST') return '创建用户';
    if (method === 'PUT') return '更新用户';
    if (method === 'DELETE') return '删除用户';
  }
  if (p.startsWith('/api/terminal')) {
    if (method === 'POST') return '终端操作';
    if (method === 'GET') return '终端读取';
  }

  return '';
};

const normalizeHttpStatus = (status) => {
  const s = parseInt(status, 10);
  if (!isNaN(s) && s >= 100 && s < 600) return s;
  return 200;
};

const normalizeMsg = (msg) => {
  if (typeof msg === 'string') return msg;
  if (msg && typeof msg === 'object' && typeof msg.message === 'string') return msg.message;
  return String(msg);
};

const safeUserIdValue = (id) => {
  if (id === undefined || id === null) return 0;
  const parsed = parseInt(id, 10);
  return isNaN(parsed) ? 0 : parsed;
};

const normalizeApiPath = (p) => {
  const raw = String(p ?? '').trim().replace(/\\/g, '/');
  if (!raw || raw === '.' || raw === './') return '/';
  if (raw.startsWith('/')) return path.posix.normalize(raw);
  return path.posix.normalize(`/${raw}`);
};

const ensure = (args) => {
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null) {
      throw createError(`${key} required`, 400);
    }
    if (typeof value === 'string' && value.trim() === '') {
      throw createError(`${key} required`, 400);
    }
    if (Array.isArray(value) && value.length === 0) {
      throw createError(`${key} required`, 400);
    }
  }
};

module.exports = {
  createError,
  defaultInferActionFrom,
  normalizeHttpStatus,
  normalizeMsg,
  safeUserIdValue,
  normalizeApiPath,
  ensure
};
