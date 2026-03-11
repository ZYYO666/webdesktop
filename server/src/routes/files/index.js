const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../utils/response');
const authorize = require('../../middleware/auth');
const upload = require('../../middleware/upload');
const { uploadFile } = require('./upload-service');
const { listFiles, getFileContent, getFileStats, createDirectory, saveFile, renameFile, moveFile, copyFile } = require('../../services/file-service');
const { deleteFile, restoreFile } = require('./trash-service');

// API: 上传文件
router.post('/upload', authorize('user'), upload.single('file'), asyncHandler(async (req) => {
  const result = await uploadFile(req.body?.path, req.file, req.user?.id);
  return [result.message];
}));

// API: 获取指定目录下的内容
router.get('/list', authorize('user'), asyncHandler(async (req) => {
  const reqPath = req.query.path || '';
  const response = await listFiles(reqPath, req.user?.id);
  return ['Directory listed', response];
}));

// API: 获取文件内容
router.get('/file', authorize('user'), asyncHandler(async (req, res) => {
  const filePath = req.query.path;
  
  // Set cache control for file content (1 year immutable)
  // ETag support is handled automatically by asyncHandler
  res.set('Cache-Control', 'public, max-age=31536000, immutable');

  // 直接返回，asyncHandler 会处理 Buffer 响应
  return await getFileContent(filePath, req.user?.id);
}));

// API: 获取文件详细信息
router.get('/stat', authorize('user'), asyncHandler(async (req) => {
  const filePath = req.query.path;
  const details = await getFileStats(filePath, req.user?.id);
  return ['File statistics', details];
}));

// API: 创建文件夹
router.post('/mkdir', authorize('user'), asyncHandler(async (req) => {
  const { path: parentPath, name } = req.body;
  const result = await createDirectory(parentPath, name, req.user.id);
  return [result.message];
}));

// API: 保存文件内容
router.post('/save', authorize('user'), asyncHandler(async (req) => {
  const { path: filePath, content } = req.body;
  const result = await saveFile(filePath, content, req.user.id);
  return [result.message];
}));

// API: 重命名
router.post('/rename', authorize('user'), asyncHandler(async (req) => {
  const { oldPath, newName } = req.body;
  const result = await renameFile(oldPath, newName, req.user.id);
  return [result.message];
}));

// API: 删除
router.post('/delete', authorize('user'), asyncHandler(async (req) => {
  const { path: targetPath } = req.body;
  const result = await deleteFile(targetPath, req.user.id);
  return [result.message];
}));

// API: 移动
router.post('/move', authorize('user'), asyncHandler(async (req) => {
  const { oldPath, newPath } = req.body;
  const result = await moveFile(oldPath, newPath, req.user.id);
  return [result.message];
}));

// API: 复制
router.post('/copy', authorize('user'), asyncHandler(async (req) => {
  const { oldPath, newPath } = req.body;
  const result = await copyFile(oldPath, newPath, req.user.id);
  return [result.message];
}));

// API: 还原文件
router.post('/restore', authorize('user'), asyncHandler(async (req) => {
  const { path: trashPath } = req.body;
  const result = await restoreFile(trashPath, req.user.id);
  return [result.message];
}));

module.exports = router;
