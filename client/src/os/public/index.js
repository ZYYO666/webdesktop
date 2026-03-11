export { OS_INJECTION_KEY, createOs, provideOs, useOs } from '../impl/index';
export {
  defineApp,
  getFileExtension,
  toAppKey,
  getAppTitle,
  isDirectoryFile,
  toAppFileRef,
  normalizeFileRef,
  normalizeFiles,
  resolveBestAppForFile,
  asArray,
  compactArray,
  getParentDirPath,
  getPathBaseName,
  joinPath,
  getFileLabel,
  reopenCurrentAppWindow,
  setDragPayload,
  getDragPayload,
  getDragFiles
} from '../utils/utils';
export { FILE_EXTENSIONS, getFileExt } from '../utils/fileTypes';
