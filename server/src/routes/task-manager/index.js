const express = require('express');
const router = express.Router();
const authorize = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/response');
const { getDashboardStats, getSystemInfo, getSystemMetrics, getNetworkConnections, getStorageIo, getFsStats, getProcessSnapshot, getProcessDetail, killProcess } = require('./service');
const { systemPowerControl, dockerControl, appControl } = require('./control-service');

// API: Get Dashboard Stats
router.get('/stats', authorize('admin'), asyncHandler(async () => {
  const stats = await getDashboardStats();
  return ['任务管理器数据', stats];
}));

router.get('/system/info', authorize('admin'), asyncHandler(async () => {
  const data = await getSystemInfo();
  return ['System info', data];
}));

router.get('/system/metrics', authorize('admin'), asyncHandler(async (req) => {
  const data = await getSystemMetrics(req.query || {});
  return ['System metrics', data];
}));

router.get('/system/network/connections', authorize('admin'), asyncHandler(async (req) => {
  const data = await getNetworkConnections(req.query || {});
  return ['Network connections', data];
}));

router.get('/system/storage/io', authorize('admin'), asyncHandler(async () => {
  const data = await getStorageIo();
  return ['Storage IO', data];
}));

router.get('/system/fs/stats', authorize('admin'), asyncHandler(async () => {
  const data = await getFsStats();
  return ['FS stats', data];
}));

router.get('/processes', authorize('admin'), asyncHandler(async (req) => {
  const data = await getProcessSnapshot(req.query || {});
  return ['Process list', data];
}));

router.get('/process/:pid', authorize('admin'), asyncHandler(async (req) => {
  const data = await getProcessDetail(req.params.pid);
  return ['Process detail', data];
}));

router.post('/process/:pid/kill', authorize('admin'), asyncHandler(async (req) => {
  const data = await killProcess(req.params.pid, req.body?.signal);
  return ['Process killed', data];
}));

// API: System Power Control (Shutdown/Reboot)
router.post('/power/:action', authorize('admin'), asyncHandler(async (req) => {
    const { action } = req.params;
    return await systemPowerControl(action);
}));

// API: Application Control (Restart Server)
router.post('/app/:action', authorize('admin'), asyncHandler(async (req) => {
    const { action } = req.params;
    return await appControl(action);
}));

// API: Docker Container Control
router.post('/docker/:id/:action', authorize('admin'), asyncHandler(async (req) => {
    const { id, action } = req.params;
    return await dockerControl(id, action);
}));

module.exports = router;
