const express = require('express');
const router = express.Router();
const authorize = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/response');
const { getAppData, getAppDataKey, setAppData, deleteAppData } = require('./service');

// Middleware to ensure user is authenticated
router.use(authorize('user'));

// Get all data for an app
router.get('/:appId', asyncHandler(async (req) => {
  const { appId } = req.params;
  const userId = req.user.id;
  const data = await getAppData(appId, userId);
  return ['Data retrieved', data];
}));

// Get specific key
router.get('/:appId/:key', asyncHandler(async (req) => {
  const { appId, key } = req.params;
  const userId = req.user.id;
  const data = await getAppDataKey(appId, key, userId);
  return ['Data retrieved', data];
}));

// Set data (Upsert)
router.post('/:appId/:key', asyncHandler(async (req) => {
  const { appId, key } = req.params;
  const { value } = req.body;
  const userId = req.user.id;
  
  await setAppData(appId, key, value, userId);
  return ['Data saved'];
}));

// Delete data
router.delete('/:appId/:key', asyncHandler(async (req) => {
  const { appId, key } = req.params;
  const userId = req.user.id;

  await deleteAppData(appId, key, userId);
  return ['Data deleted'];
}));

module.exports = router;