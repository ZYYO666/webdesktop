const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../utils/response');
const authorize = require('../../middleware/auth');
const service = require('./service');

// API: 获取缩略图
router.get('/', authorize('user'), asyncHandler(async (req, res) => {
  const filePath = req.query.path;
  const time = req.query.time;
  const width = req.query.width;
  
  // 缓存控制仍需在这里设置，因为它是 HTTP 层面的策略
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  
  // 直接返回包含 buffer 的对象，asyncHandler 会处理发送
  return await service.getThumbnail(filePath, req.user?.id, { time, width });
}));

module.exports = router;
