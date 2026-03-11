const mime = require('mime-types');

const getLowercaseExtension = (input) => {
  const raw = String(input ?? '');
  const base = raw.split('/').pop() || raw;
  const dotIndex = base.lastIndexOf('.');
  if (dotIndex <= 0) return '';
  return base.slice(dotIndex + 1).toLowerCase();
};

const inferMimeTypeFromExtension = (ext) => {
  const e = String(ext ?? '').toLowerCase();
  return mime.lookup(e) || 'application/octet-stream';
};

module.exports = { getLowercaseExtension, inferMimeTypeFromExtension };
