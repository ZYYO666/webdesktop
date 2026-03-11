export const FILE_EXTENSIONS = {
  IMAGE: new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tif', 'tiff', 'ico', 'avif', 'heic', 'heif']),
  VIDEO: new Set(['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v', '3gp', 'mts', 'm2ts', 'ts', 'vob', 'ogv', 'm3u8']),
  AUDIO: new Set(['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'aiff', 'alac', 'opus', 'amr', 'mid', 'midi']),
  MODEL: new Set(['obj', 'fbx', 'glb', 'gltf', 'stl', 'blend', '3ds', 'dae']),
  APP: new Set(['exe', 'msi', 'dmg', 'pkg', 'app', 'apk', 'ipa', 'jar', 'appimage']),
  ARCHIVE: new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz', 'tbz', 'tbz2', 'zst', 'lz', 'lz4', 'cab']),
  CODE: new Set(['js', 'jsx', 'ts', 'tsx', 'vue', 'html', 'css', 'scss', 'less', 'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'env', 'config', 'md', 'py', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'rs', 'php', 'rb', 'sh', 'bat', 'cmd', 'ps1', 'bash', 'zsh', 'sql', 'gitignore', 'dockerfile']),
  DATABASE: new Set(['sql', 'db', 'sqlite', 'sqlite3', 'mdb', 'accdb']),
  FONT: new Set(['ttf', 'otf', 'woff', 'woff2', 'eot'])
};

export const getFileExt = (name) => {
  if (!name || typeof name !== 'string') return '';
  return name.split('.').pop().toLowerCase();
};

