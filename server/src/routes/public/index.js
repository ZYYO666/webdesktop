const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../utils/response');
const authorize = require('../../middleware/auth');
const service = require('./service');

// Public access to shared files
router.get('/:id', authorize('guest'), asyncHandler(async (req) => {
  const { id } = req.params;
  // asyncHandler will detect { buffer, mimeType, name } and handle file response
  return await service.getSharedFile(id);
}));

module.exports = router;
