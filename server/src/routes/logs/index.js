const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../utils/response');
const { getLogs } = require('./service');
const authorize = require('../../middleware/auth');

router.use(authorize('admin'));

router.get('/', asyncHandler(async (req) => {
  const logs = await getLogs(req.query);
  return ['Logs', logs];
}));

module.exports = router;