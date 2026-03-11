const express = require('express');
const router = express.Router();
const authorize = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/response');
const { getSiteInfo } = require('./service');

// API: 公开站点信息 (支持可选鉴权以获取用户偏好)
router.get('/site-info', authorize('guest'), asyncHandler(async (req) => {
  const info = await getSiteInfo(req.user?.id);
  return ['Site Info', info];
}));

module.exports = router;
