import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  validateStatus: () => true,
});

let unauthorizedHandling = false;
const handleUnauthorized = () => {
  if (unauthorizedHandling) return;
  unauthorizedHandling = true;

  const wasLoggedIn = !!localStorage.getItem('auth_token');
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');

  if (wasLoggedIn) {
    try {
      sessionStorage.setItem('auth_expired', '1');
    } catch {
      void 0;
    }
  }

  if (wasLoggedIn && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const data = response?.data;

    if (response.status === 401) {
      handleUnauthorized();
    }

    if (data && typeof data === 'object' && data.success === false) {
      const err = new Error(data.msg || data.message || 'Request failed');
      err.name = 'ApiError';
      err.isAxiosError = true;
      err.response = { ...response, data };
      err.config = response.config;
      return Promise.reject(err);
    }

    if (data === false) {
      const err = new Error('Request failed');
      err.name = 'ApiError';
      err.isAxiosError = true;
      err.response = response;
      err.config = response.config;
      return Promise.reject(err);
    }

    if (response.status >= 400) {
      const msg =
        typeof data === 'object' && (data?.msg || data?.message) ? data.msg || data.message : response.statusText || 'Request failed';
      const err = new Error(msg);
      err.name = 'ApiError';
      err.isAxiosError = true;
      err.response = { ...response, data };
      err.config = response.config;
      return Promise.reject(err);
    }

    return response;
  },
  (error) => {
    if (error?.response?.status === 401) handleUnauthorized();
    return Promise.reject(error);
  }
);

export const login = (username, password) => api.post('/auth/login', { username, password });
export const register = (username, password) => api.post('/auth/register', { username, password });
export const getMe = () => api.get('/auth/me');

export const getTaskManagerStats = () => api.get('/task-manager/stats');
export const getSystemInfo = () => api.get('/task-manager/system/info');
export const getSystemMetrics = (params = {}) => api.get('/task-manager/system/metrics', { params });
export const getNetworkConnections = (params = {}) => api.get('/task-manager/system/network/connections', { params });
export const getStorageIo = () => api.get('/task-manager/system/storage/io');
export const getFsStats = () => api.get('/task-manager/system/fs/stats');
export const systemPower = (action) => api.post(`/task-manager/power/${action}`);
export const systemApp = (action) => api.post(`/task-manager/app/${action}`);
export const dockerControl = (id, action) => api.post(`/task-manager/docker/${id}/${action}`);
export const getProcessList = (params = {}) => api.get('/task-manager/processes', { params });
export const getProcessDetail = (pid) => api.get(`/task-manager/process/${pid}`);
export const killProcess = (pid, signal) => api.post(`/task-manager/process/${pid}/kill`, { signal });

export const getList = (path) => api.get('/list', { params: { path } });
export const getThumbUrl = (path) => {
  const token = localStorage.getItem('auth_token');
  const base = `/api/thumbnail?path=${encodeURIComponent(path)}`;
  return token ? `${base}&token=${token}` : base;
};
export const getFileUrl = (path) => {
  const token = localStorage.getItem('auth_token');
  const base = `/api/file?path=${encodeURIComponent(path)}`;
  return token ? `${base}&token=${token}` : base;
};
export const getFileContent = (path, options = {}) =>
  api.get('/file', { params: { path, _t: Date.now() }, responseType: 'text', ...options });
export const getFileStat = (path) => api.get('/stat', { params: { path } });
export const renameFile = (oldPath, newName) => api.post('/rename', { oldPath, newName });
export const deleteFile = (path) => api.post('/delete', { path });
export const createDirectory = (path, name) => api.post('/mkdir', { path, name });
export const moveFile = (oldPath, newPath) => api.post('/move', { oldPath, newPath });
export const copyFile = (oldPath, newPath) => api.post('/copy', { oldPath, newPath });
export const compressFiles = (files, archiveName, parentPath) => api.post('/archive/compress', { files, archiveName, parentPath });
export const extractFile = (path, destination) => api.post('/archive/extract', { path, destination });
export const restoreFile = (path) => api.post('/restore', { path });
export const saveFileContent = (path, content) => api.post('/save', { path, content });
export const searchFiles = (query, path) => api.get('/search', { params: { q: query, path } });
export const uploadFile = (path, file, onProgress) => {
  const formData = new FormData();
  formData.append('path', path);
  formData.append('file', file);

  return api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percentCompleted);
      }
    },
  });
};

export const getSiteInfo = () => api.get('/site-info');
export const getSettings = () => api.get('/settings');
export const saveSettings = (key, value) => api.post('/settings', { key, value });
export const clearCache = () => api.post('/settings/clear-cache');

export const getMyMounts = () => api.get('/mounts/mine');
export const addMyMount = (mountPoint, localPath, type, config) =>
  api.post('/mounts/mine', { mountPoint, localPath, type, config });
export const updateMyMount = (id, mountPoint, localPath, type, config) =>
  api.put(`/mounts/mine/${id}`, { mountPoint, localPath, type, config });
export const deleteMyMount = (id) => api.delete(`/mounts/mine/${id}`);

export const getUsers = () => api.get('/users');
export const addUser = (username, password, role) => api.post('/users', { username, password, role });
export const updateUser = (id, data) => api.put(`/users/${id}`, data);
export const deleteUser = (id) => api.delete(`/users/${id}`);
export const updateProfile = (data) => api.put('/auth/me', data);

export const getAppData = (appId) => api.get(`/app-data/${appId}`);
export const getAppDataKey = (appId, key) => api.get(`/app-data/${appId}/${key}`);
export const setAppData = (appId, key, value) => api.post(`/app-data/${appId}/${key}`, { value });
export const deleteAppData = (appId, key) => api.delete(`/app-data/${appId}/${key}`);

export const getFavorites = () => api.get('/favorites');
export const addFavorite = (path) => api.post('/favorites', { path });
export const removeFavorite = (path) => api.delete('/favorites', { params: { path } });

export const getShares = () => api.get('/shares');
export const createShare = (path) => api.post('/shares', { path });
export const deleteShare = (id) => api.delete(`/shares/${id}`);

export const terminalExec = (command, sessionId, timeoutMs) => api.post('/terminal/exec', { command, sessionId, timeoutMs });

export const getRequestLogs = (params = {}) => api.get('/logs', { params });
export const clearRequestLogs = (params = {}) => api.delete('/logs', { params });

export const downloaderCreateTask = (body) => api.post('/downloader/tasks', body);
export const downloaderCreateM3u8ToMp4Task = (body) => api.post('/downloader/tasks/m3u8-to-mp4', body);
export const downloaderListTasks = () => api.get('/downloader/tasks');
export const downloaderGetTask = (id) => api.get(`/downloader/tasks/${id}`);
export const downloaderCancelTask = (id) => api.post(`/downloader/tasks/${id}/cancel`);
export const downloaderPauseTask = (id) => api.post(`/downloader/tasks/${id}/pause`);
export const downloaderResumeTask = (id) => api.post(`/downloader/tasks/${id}/resume`);
export const downloaderDeleteTask = (id) => api.delete(`/downloader/tasks/${id}`);
export const downloaderPauseAllTasks = () => api.post('/downloader/tasks/pause-all');
export const downloaderResumeAllTasks = () => api.post('/downloader/tasks/resume-all');
export const downloaderClearTasks = (body) => api.post('/downloader/tasks/clear', body);

export const dockerRuntime = () => api.get('/app-store/runtime');
export const dockerListTemplates = () => api.get('/app-store/templates');
export const dockerListContainers = () => api.get('/app-store/containers');
export const dockerInspectContainer = (ref) => api.get(`/app-store/containers/${ref}/inspect`);
export const dockerContainerStats = (ref) => api.get(`/app-store/containers/${ref}/stats`);
export const dockerContainerTop = (ref) => api.get(`/app-store/containers/${ref}/top`);
export const dockerContainerAction = (ref, action) => api.post(`/app-store/containers/${ref}/action`, { action });
export const dockerRemoveContainer = (ref, force = true) =>
  api.delete(`/app-store/containers/${ref}`, { params: { force: force ? '1' : '0' } });
export const dockerContainerLogs = (ref, tail = 200) => api.get(`/app-store/containers/${ref}/logs`, { params: { tail } });
export const dockerRunContainer = (body) => api.post('/app-store/containers/run', body);
export const dockerContainerExec = (ref, body) => api.post(`/app-store/containers/${ref}/exec`, body);
export const dockerUpdateContainerLabels = (ref, body) => api.post(`/app-store/containers/${ref}/labels`, body);
export const dockerRecreateContainer = (ref, body) => api.post(`/app-store/containers/${ref}/recreate`, body);
export const dockerListInstallJobs = (limit = 30, projectKey = null) =>
  api.get('/app-store/install-jobs', { params: { limit, ...(projectKey ? { projectKey } : {}) } });
export const dockerGetInstallJob = (id) => api.get(`/app-store/install-jobs/${id}`);
export const dockerCreateInstallJob = (templateId, overrides = {}) => api.post('/app-store/install-jobs', { templateId, overrides });
export const dockerCancelInstallJob = (id) => api.post(`/app-store/install-jobs/${id}/cancel`);
export const dockerDeleteInstallJob = (id) => api.delete(`/app-store/install-jobs/${id}`);
export const dockerListImages = () => api.get('/app-store/images');
export const dockerPullImage = (image) => api.post('/app-store/images/pull', { image });

const unwrapResponse = (res) => {
  const data = res?.data;
  if (data && typeof data === 'object' && 'data' in data) return data.data;
  return data;
};

export const createApi = () => {
  return {
    login: async (username, password) => unwrapResponse(await login(username, password)),
    register: async (username, password) => unwrapResponse(await register(username, password)),
    getMe: async () => unwrapResponse(await getMe()),

    getTaskManagerStats: async () => unwrapResponse(await getTaskManagerStats()),
    getSystemInfo: async () => unwrapResponse(await getSystemInfo()),
    getSystemMetrics: async (params = {}) => unwrapResponse(await getSystemMetrics(params)),
    getNetworkConnections: async (params = {}) => unwrapResponse(await getNetworkConnections(params)),
    getStorageIo: async () => unwrapResponse(await getStorageIo()),
    getFsStats: async () => unwrapResponse(await getFsStats()),
    systemPower: async (action) => unwrapResponse(await systemPower(action)),
    systemApp: async (action) => unwrapResponse(await systemApp(action)),
    dockerControl: async (id, action) => unwrapResponse(await dockerControl(id, action)),
    getProcessList: async (params = {}) => unwrapResponse(await getProcessList(params)),
    getProcessDetail: async (pid) => unwrapResponse(await getProcessDetail(pid)),
    killProcess: async (pid, signal) => unwrapResponse(await killProcess(pid, signal)),

    getList: async (path) => {
      const data = unwrapResponse(await getList(path));
      return Array.isArray(data?.files) ? data.files : [];
    },
    getThumbUrl,
    getFileUrl,
    getFileContent: async (path, options = {}) => unwrapResponse(await getFileContent(path, options)),
    getFileStat: async (path) => unwrapResponse(await getFileStat(path)),
    renameFile: async (oldPath, newName) => unwrapResponse(await renameFile(oldPath, newName)),
    deleteFile: async (path) => unwrapResponse(await deleteFile(path)),
    createDirectory: async (path, name) => unwrapResponse(await createDirectory(path, name)),
    moveFile: async (oldPath, newPath) => unwrapResponse(await moveFile(oldPath, newPath)),
    copyFile: async (oldPath, newPath) => unwrapResponse(await copyFile(oldPath, newPath)),
    compressFiles: async (files, archiveName, parentPath) => unwrapResponse(await compressFiles(files, archiveName, parentPath)),
    extractFile: async (path, destination) => unwrapResponse(await extractFile(path, destination)),
    restoreFile: async (path) => unwrapResponse(await restoreFile(path)),
    saveFileContent: async (path, content) => unwrapResponse(await saveFileContent(path, content)),
    searchFiles: async (query, path) => unwrapResponse(await searchFiles(query, path)),
    uploadFile: async (path, file, onProgress) => unwrapResponse(await uploadFile(path, file, onProgress)),

    getSiteInfo: async () => unwrapResponse(await getSiteInfo()),
    getSettings: async () => unwrapResponse(await getSettings()),
    saveSettings: async (key, value) => unwrapResponse(await saveSettings(key, value)),
    clearCache: async () => unwrapResponse(await clearCache()),

    getMyMounts: async () => unwrapResponse(await getMyMounts()),
    addMyMount: async (mountPoint, localPath, type, config) => unwrapResponse(await addMyMount(mountPoint, localPath, type, config)),
    updateMyMount: async (id, mountPoint, localPath, type, config) =>
      unwrapResponse(await updateMyMount(id, mountPoint, localPath, type, config)),
    deleteMyMount: async (id) => unwrapResponse(await deleteMyMount(id)),

    getUsers: async () => unwrapResponse(await getUsers()),
    addUser: async (username, password, role) => unwrapResponse(await addUser(username, password, role)),
    updateUser: async (id, data) => unwrapResponse(await updateUser(id, data)),
    deleteUser: async (id) => unwrapResponse(await deleteUser(id)),
    updateProfile: async (data) => unwrapResponse(await updateProfile(data)),

    getAppData: async (appId) => unwrapResponse(await getAppData(appId)),
    getAppDataKey: async (appId, key) => unwrapResponse(await getAppDataKey(appId, key)),
    setAppData: async (appId, key, value) => unwrapResponse(await setAppData(appId, key, value)),
    deleteAppData: async (appId, key) => unwrapResponse(await deleteAppData(appId, key)),

    getFavorites: async () => unwrapResponse(await getFavorites()),
    addFavorite: async (path) => unwrapResponse(await addFavorite(path)),
    removeFavorite: async (path) => unwrapResponse(await removeFavorite(path)),

    getShares: async () => unwrapResponse(await getShares()),
    createShare: async (path) => unwrapResponse(await createShare(path)),
    deleteShare: async (id) => unwrapResponse(await deleteShare(id)),

    terminalExec: async (command, sessionId, timeoutMs) => unwrapResponse(await terminalExec(command, sessionId, timeoutMs)),

    getRequestLogs: async (params = {}) => unwrapResponse(await getRequestLogs(params)),
    clearRequestLogs: async (params = {}) => unwrapResponse(await clearRequestLogs(params)),

    downloaderCreateTask: async (body) => unwrapResponse(await downloaderCreateTask(body)),
    downloaderCreateM3u8ToMp4Task: async (body) => unwrapResponse(await downloaderCreateM3u8ToMp4Task(body)),
    downloaderListTasks: async () => unwrapResponse(await downloaderListTasks()),
    downloaderGetTask: async (id) => unwrapResponse(await downloaderGetTask(id)),
    downloaderCancelTask: async (id) => unwrapResponse(await downloaderCancelTask(id)),
    downloaderPauseTask: async (id) => unwrapResponse(await downloaderPauseTask(id)),
    downloaderResumeTask: async (id) => unwrapResponse(await downloaderResumeTask(id)),
    downloaderDeleteTask: async (id) => unwrapResponse(await downloaderDeleteTask(id)),
    downloaderPauseAllTasks: async () => unwrapResponse(await downloaderPauseAllTasks()),
    downloaderResumeAllTasks: async () => unwrapResponse(await downloaderResumeAllTasks()),
    downloaderClearTasks: async (body) => unwrapResponse(await downloaderClearTasks(body)),
    dockerRuntime: async () => unwrapResponse(await dockerRuntime()),
    dockerListTemplates: async () => unwrapResponse(await dockerListTemplates()),
    dockerListContainers: async () => unwrapResponse(await dockerListContainers()),
    dockerInspectContainer: async (ref) => unwrapResponse(await dockerInspectContainer(ref)),
    dockerContainerStats: async (ref) => unwrapResponse(await dockerContainerStats(ref)),
    dockerContainerTop: async (ref) => unwrapResponse(await dockerContainerTop(ref)),
    dockerContainerAction: async (ref, action) => unwrapResponse(await dockerContainerAction(ref, action)),
    dockerRemoveContainer: async (ref, force = true) => unwrapResponse(await dockerRemoveContainer(ref, force)),
    dockerContainerLogs: async (ref, tail = 200) => unwrapResponse(await dockerContainerLogs(ref, tail)),
    dockerRunContainer: async (body) => unwrapResponse(await dockerRunContainer(body)),
    dockerContainerExec: async (ref, body) => unwrapResponse(await dockerContainerExec(ref, body)),
    dockerUpdateContainerLabels: async (ref, body) => unwrapResponse(await dockerUpdateContainerLabels(ref, body)),
    dockerRecreateContainer: async (ref, body) => unwrapResponse(await dockerRecreateContainer(ref, body)),
    dockerListInstallJobs: async (limit = 30, projectKey = null) => unwrapResponse(await dockerListInstallJobs(limit, projectKey)),
    dockerGetInstallJob: async (id) => unwrapResponse(await dockerGetInstallJob(id)),
    dockerCreateInstallJob: async (templateId, overrides = {}) => unwrapResponse(await dockerCreateInstallJob(templateId, overrides)),
    dockerCancelInstallJob: async (id) => unwrapResponse(await dockerCancelInstallJob(id)),
    dockerDeleteInstallJob: async (id) => unwrapResponse(await dockerDeleteInstallJob(id)),
    dockerListImages: async () => unwrapResponse(await dockerListImages()),
    dockerPullImage: async (image) => unwrapResponse(await dockerPullImage(image)),
  };
};
