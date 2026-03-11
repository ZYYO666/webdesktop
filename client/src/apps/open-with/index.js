import { defineAsyncComponent } from 'vue';
import { defineApp } from '@/os';
import {
  Archive,
  Box,
  Database,
  Disc,
  FileAudio,
  FileCode2,
  FileCog,
  FileImage,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Link2,
  Palette,
  Presentation,
  Shield,
  Type,
  BookOpen,
  Package
} from 'lucide-vue-next';

const AppOpenWith = defineAsyncComponent(() => import('./index.vue'));

const IMAGE_EXTS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tif', 'tiff', 'ico', 'avif', 'heic', 'heif', 'jxl',
  'raw', 'arw', 'cr2', 'cr3', 'nef', 'dng', 'orf', 'rw2'
]);
const VIDEO_EXTS = new Set([
  'mp4', 'm4v', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', '3gp', '3g2', 'mts', 'm2ts', 'ts', 'vob', 'ogv', 'mxf'
]);
const AUDIO_EXTS = new Set([
  'mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'aiff', 'alac', 'opus', 'amr', 'mid', 'midi', 'caf'
]);
const PDF_EXTS = new Set(['pdf']);
const OFFICE_EXTS = new Set(['doc', 'docx', 'odt', 'rtf', 'pages']);
const SHEET_EXTS = new Set(['xls', 'xlsx', 'ods', 'csv', 'tsv', 'numbers']);
const SLIDE_EXTS = new Set(['ppt', 'pptx', 'odp', 'key']);
const EBOOK_EXTS = new Set(['epub', 'mobi', 'azw', 'azw3', 'fb2', 'cbz', 'cbr']);
const ARCHIVE_EXTS = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz', 'tbz', 'tbz2', 'zst', 'lz', 'lz4', 'cab']);
const DISK_EXTS = new Set(['iso', 'img', 'bin', 'cue', 'dmg', 'vhd', 'vhdx', 'qcow2']);
const APP_EXTS = new Set(['exe', 'msi', 'dmg', 'pkg', 'app', 'apk', 'ipa', 'jar', 'appimage', 'deb', 'rpm']);
const FONT_EXTS = new Set(['ttf', 'otf', 'woff', 'woff2', 'eot']);
const DATABASE_EXTS = new Set(['sql', 'db', 'sqlite', 'sqlite3', 'mdb', 'accdb', 'parquet', 'duckdb']);
const MODEL_EXTS = new Set(['obj', 'fbx', 'glb', 'gltf', 'stl', 'blend', '3ds', 'dae', 'ply']);
const DESIGN_EXTS = new Set(['psd', 'ai', 'sketch', 'fig', 'xd']);
const CERT_EXTS = new Set(['pem', 'crt', 'cer', 'key', 'p12', 'pfx', 'csr']);
const CONFIG_OVERRIDE_EXTS = new Set(['toml', 'ini', 'env']);
const MARKDOWN_OVERRIDE_EXTS = new Set(['md', 'markdown']);
const JSONC_OVERRIDE_EXTS = new Set(['jsonc']);
const CODE_EXTS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'vue', 'html', 'css', 'scss', 'less',
  'md', 'mdx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'php', 'rb', 'swift', 'kt', 'kts', 'dart', 'lua',
  'sh', 'bash', 'zsh', 'bat', 'cmd', 'ps1', 'sql', 'graphql', 'gql',
  'dockerfile', 'makefile', 'gitignore'
]);
const DATA_EXTS = new Set(['json', 'jsonl', 'xml', 'yml', 'yaml', 'toml', 'ini', 'env', 'cfg', 'conf', 'properties']);
const TEXT_EXTS = new Set(['txt', 'log', 'nfo', 'license', 'readme']);
const SHORTCUT_EXTS = new Set(['shortcut', 'lnk', 'url', 'webloc']);

export default defineApp({
  id: 'open-with',
  name: '打开方式',
  component: AppOpenWith,
  width: 500,
  height: 600,
  resizable: false,
  minimizable: false,
  maximizable: false,
  role: 'guest',
  supports: {
    priority: -100,
    extensionGroups: [
      { id: 'config-override', icon: FileCog, fgClass: 'text-slate-700', bgClass: 'bg-slate-100', extensions: CONFIG_OVERRIDE_EXTS },
      { id: 'markdown-override', icon: FileText, fgClass: 'text-indigo-700', bgClass: 'bg-indigo-50', extensions: MARKDOWN_OVERRIDE_EXTS },
      { id: 'jsonc-override', icon: FileJson, fgClass: 'text-amber-700', bgClass: 'bg-amber-50', extensions: JSONC_OVERRIDE_EXTS },
      { id: 'image', icon: FileImage, fgClass: 'text-pink-700', bgClass: 'bg-pink-50', extensions: IMAGE_EXTS },
      { id: 'video', icon: FileVideo, fgClass: 'text-rose-700', bgClass: 'bg-rose-50', extensions: VIDEO_EXTS, isVideo: true },
      { id: 'audio', icon: FileAudio, fgClass: 'text-violet-700', bgClass: 'bg-violet-50', extensions: AUDIO_EXTS },
      { id: 'pdf', icon: FileText, fgClass: 'text-red-700', bgClass: 'bg-red-50', extensions: PDF_EXTS },
      { id: 'office', icon: FileText, fgClass: 'text-blue-700', bgClass: 'bg-blue-50', extensions: OFFICE_EXTS },
      { id: 'sheet', icon: FileSpreadsheet, fgClass: 'text-green-700', bgClass: 'bg-green-50', extensions: SHEET_EXTS },
      { id: 'slide', icon: Presentation, fgClass: 'text-orange-700', bgClass: 'bg-orange-50', extensions: SLIDE_EXTS },
      { id: 'ebook', icon: BookOpen, fgClass: 'text-amber-800', bgClass: 'bg-amber-50', extensions: EBOOK_EXTS },
      { id: 'archive', icon: Archive, fgClass: 'text-yellow-800', bgClass: 'bg-yellow-50', extensions: ARCHIVE_EXTS },
      { id: 'disk', icon: Disc, fgClass: 'text-slate-700', bgClass: 'bg-slate-100', extensions: DISK_EXTS },
      { id: 'app', icon: Package, fgClass: 'text-slate-700', bgClass: 'bg-slate-100', extensions: APP_EXTS },
      { id: 'font', icon: Type, fgClass: 'text-slate-700', bgClass: 'bg-slate-100', extensions: FONT_EXTS },
      { id: 'database', icon: Database, fgClass: 'text-cyan-700', bgClass: 'bg-cyan-50', extensions: DATABASE_EXTS },
      { id: 'model', icon: Box, fgClass: 'text-slate-700', bgClass: 'bg-slate-100', extensions: MODEL_EXTS },
      { id: 'design', icon: Palette, fgClass: 'text-fuchsia-700', bgClass: 'bg-fuchsia-50', extensions: DESIGN_EXTS },
      { id: 'cert', icon: Shield, fgClass: 'text-slate-700', bgClass: 'bg-slate-100', extensions: CERT_EXTS },
      { id: 'code', icon: FileCode2, fgClass: 'text-emerald-700', bgClass: 'bg-emerald-50', extensions: CODE_EXTS },
      { id: 'data', icon: FileJson, fgClass: 'text-amber-700', bgClass: 'bg-amber-50', extensions: DATA_EXTS },
      { id: 'text', icon: FileText, fgClass: 'text-slate-700', bgClass: 'bg-slate-100', extensions: TEXT_EXTS },
      { id: 'shortcut', icon: Link2, fgClass: 'text-sky-700', bgClass: 'bg-sky-50', extensions: SHORTCUT_EXTS }
    ]
  }
});
