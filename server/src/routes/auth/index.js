const express = require('express');
const router = express.Router();
const authorize = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/response');
const { login, register, getCurrentUser, updateCurrentUser, logout } = require('./service');

// Auth Routes
router.post('/login', asyncHandler(async (req) => {
  const { username, password } = req.body;
  const result = await login(username, password);
  return ['Login successful', result];
}));

router.post('/register', asyncHandler(async (req) => {
  const { username, password } = req.body;
  const result = await register(username, password);
  return ['Registration successful', result];
}));

router.get('/me', authorize('user'), asyncHandler(async (req) => {
  const userInfo = await getCurrentUser(req.user.id);
  return ['User info', userInfo];
}));

router.put('/me', authorize('user'), asyncHandler(async (req) => {
  await updateCurrentUser(req.user.id, req.body);
  return ['User updated successfully'];
}));

router.post('/logout', authorize('user'), asyncHandler(async (req) => {
  await logout(req.user.id);
  return ['Logged out successfully'];
}));

module.exports = router;