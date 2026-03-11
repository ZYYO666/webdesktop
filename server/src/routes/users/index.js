const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../utils/response');
const authorize = require('../../middleware/auth');
const { listUsers, createUser, updateUser, deleteUser } = require('./service');

// User Management (Admin only)
router.get('/', authorize('admin'), asyncHandler(async () => {
  const users = await listUsers();
  return ['Users list', users];
}));

router.post('/', authorize('admin'), asyncHandler(async (req) => {
  const { username, password, role } = req.body;
  await createUser(username, password, role);
  return ['User created'];
}));

router.put('/:id', authorize('admin'), asyncHandler(async (req) => {
  const { password, role } = req.body;
  await updateUser(req.params.id, password, role);
  return ['User updated'];
}));

router.delete('/:id', authorize('admin'), asyncHandler(async (req) => {
  await deleteUser(req.params.id);
  return ['User deleted'];
}));

module.exports = router;