const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../utils/response');
const authorize = require('../../middleware/auth');
const { execOsTerminal } = require('./service');

router.post('/exec', authorize('admin'), asyncHandler(async (req) => {
  const result = await execOsTerminal(req.user, req.body);
  return ['Executed', result];
}));

module.exports = router;
