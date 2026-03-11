const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../utils/response');
const authorize = require('../../middleware/auth');
const { searchFiles } = require('./service');

// API: 搜索文件
router.get('/', authorize('user'), asyncHandler(async (req) => {
  const { q, path: searchPath } = req.query;
  const results = await searchFiles(q, searchPath, req.user.id);
  return ['Search results', results];
}));

module.exports = router;