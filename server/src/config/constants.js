const path = require('path');
const os = require('os');
const fs = require('fs-extra');

const appName = 'cloudgallery';
const homedir = os.homedir();
const platform = os.platform();

let baseDir;
const overrideBaseDir = String(process.env.CLOUDGALLERY_BASE_DIR || process.env.CG_BASE_DIR || '').trim();

if (overrideBaseDir) {
  baseDir = path.resolve(overrideBaseDir);
} else {
  if (platform === 'win32') {
    baseDir = path.join(process.env.APPDATA || path.join(homedir, 'AppData', 'Roaming'), appName);
  } else if (platform === 'darwin') {
    baseDir = path.join(homedir, 'Library', 'Application Support', appName);
  } else {
    // Linux and others: use ~/.config/cloudgallery or similar? 
    // User wants "Unified", and typically Linux separates cache/config.
    // But to satisfy "all in one", we can use ~/.local/share/cloudgallery or ~/.cloudgallery.
    // Let's use ~/.cloudgallery for simplicity and unified structure if not overridden.
    baseDir = path.join(homedir, '.cloudgallery');
  }
}

const CONFIG_DIR = path.join(baseDir, 'config');
const CACHE_DIR = path.join(baseDir, 'cache');
const THUMB_DIR = path.join(CACHE_DIR, 'thumbs');
const SYSTEM_ROOT = path.join(baseDir, 'system-root');
const DB_FILE = path.join(baseDir, 'data.db');

fs.ensureDirSync(baseDir);
fs.ensureDirSync(CONFIG_DIR);
fs.ensureDirSync(CACHE_DIR);
fs.ensureDirSync(THUMB_DIR);
fs.ensureDirSync(SYSTEM_ROOT);

module.exports = {
  PORT: 3001,
  JWT_SECRET: process.env.JWT_SECRET || 'you1r-seq1cret-key-change-it',
  CACHE_DIR,
  THUMB_DIR,
  DB_FILE,
  CONFIG_DIR,
  SYSTEM_ROOT
};
