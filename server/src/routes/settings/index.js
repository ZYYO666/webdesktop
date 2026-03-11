const express = require('express');
const router = express.Router();
const authorize = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/response');
const { clearCache } = require('../../services/file-service');
const { getSettings, updateSetting, clearCacheService } = require('./service');

// API: 获取设置 (需要管理员权限)
router.get('/settings', authorize('admin'), asyncHandler(async () => {
  const settings = await getSettings();
  return ['Settings', settings];
}));

// API: 更新设置
router.post('/settings', authorize('admin'), asyncHandler(async (req) => {
  const { key, value } = req.body;
  await updateSetting(key, value);
  return ['Setting updated'];
}));

// API: 清空缓存
router.post('/clear-cache', authorize('admin'), asyncHandler(async () => {
  const result = await clearCacheService(clearCache);
  return [result.message, result];
}));

module.exports = router;