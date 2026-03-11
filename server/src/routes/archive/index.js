const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../utils/response');
const authorize = require('../../middleware/auth');
const { compressFiles, extractArchive } = require('./service');

// API: 压缩文件/文件夹
router.post('/compress', authorize('user'), asyncHandler(async (req) => {
  const { files, archiveName, parentPath } = req.body;
  const result = await compressFiles(files, archiveName, parentPath, req.user.id);
  return ['Compression complete', { size: result.size }];
}));

// API: 解压文件
router.post('/extract', authorize('user'), asyncHandler(async (req) => {
  const { path: filePath, destination } = req.body;
  await extractArchive(filePath, destination, req.user.id);
  return ['Extraction complete'];
}));

module.exports = router;