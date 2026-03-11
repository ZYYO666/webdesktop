const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../utils/response');
const authorize = require('../../middleware/auth');
const { listMounts, addMount, updateMount, deleteMount } = require('./service');

router.get('/mine', authorize('user'), asyncHandler(async (req) => {
  const mounts = await listMounts(req.user.id);
  return ['User mounts list', mounts];
}));

router.post('/mine', authorize('user'), asyncHandler(async (req) => {
  const result = await addMount(req.user, req.body);
  return ['User mount added', result];
}));

router.put('/mine/:id', authorize('user'), asyncHandler(async (req) => {
  const id = Number(req.params.id);
  await updateMount(req.user, id, req.body);
  return ['User mount updated'];
}));

router.delete('/mine/:id', authorize('user'), asyncHandler(async (req) => {
  const id = Number(req.params.id);
  await deleteMount(req.user.id, id);
  return ['User mount deleted'];
}));

// Admin routes (currently redundant with mine? keeping as per original structure)
router.get('/', authorize('user'), asyncHandler(async (req) => {
    const mounts = await listMounts(req.user.id);
    return ['User mounts list', mounts];
}));

router.post('/', authorize('user'), asyncHandler(async (req) => {
    const result = await addMount(req.user, req.body);
    return ['User mount added', result];
}));

module.exports = router;