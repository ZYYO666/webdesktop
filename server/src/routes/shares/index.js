const express = require('express');
const router = express.Router();
const authorize = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/response');
const { listShares, createShare, deleteShare } = require('./service');

// List user's shared links
router.get('/', authorize('user'), asyncHandler(async (req) => {
  const shares = await listShares(req.user.id);
  return ['Shares retrieved', shares];
}));

// Create a new share link
router.post('/', authorize('user'), asyncHandler(async (req) => {
  const { path: filePath } = req.body;
  const result = await createShare(filePath, req.user.id);
  if (result.exists) {
      return ['Link already exists', result.data];
  }
  return ['Link created', result.data];
}));

// Delete a share link
router.delete('/:id', authorize('user'), asyncHandler(async (req) => {
  const { id } = req.params;
  await deleteShare(id, req.user.id);
  return ['Link deleted'];
}));

module.exports = router;