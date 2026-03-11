const path = require('path');

const normalizeApiPath = (vfsPath) => {
  let normalized = String(vfsPath ?? '').replace(/\\/g, '/');
  normalized = path.posix.normalize(normalized);
  if (!normalized || normalized === '.') normalized = '/';
  if (!normalized.startsWith('/')) normalized = '/' + normalized;
  if (normalized.length > 1) normalized = normalized.replace(/\/+$/, '');
  if (normalized === '/.') normalized = '/';
  return normalized;
};

const isWithinPath = (parentPath, childPath) => {
  const parent = path.resolve(String(parentPath ?? ''));
  const child = path.resolve(String(childPath ?? ''));
  if (!parent || !child) return false;
  return child === parent || child.startsWith(parent + path.sep);
};

const isTrashPath = (p) => {
  const n = normalizeApiPath(p ?? '/');
  return n === '/.trash' || n.startsWith('/.trash/');
};

module.exports = { normalizeApiPath, isWithinPath, isTrashPath };
