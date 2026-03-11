const express = require('express');
const router = express.Router();
const authorize = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/response');
const { createDownloadTask, createM3u8ToMp4Task, getTask, listTasks, pauseTask, pauseAllTasks, resumeTask, resumeAllTasks, cancelTask, deleteTask, clearTasks } = require('./service');

router.post('/tasks', authorize('user'), asyncHandler(async (req) => {
  const task = await createDownloadTask(req.body || {}, req.user.id);
  return ['Task created', task];
}));

router.post('/tasks/m3u8-to-mp4', authorize('user'), asyncHandler(async (req) => {
  const task = await createM3u8ToMp4Task(req.body || {}, req.user.id);
  return ['Task created', task];
}));

router.get('/tasks', authorize('user'), asyncHandler(async (req) => {
  const data = await listTasks(req.user.id);
  return ['Tasks', data];
}));

router.get('/tasks/:id', authorize('user'), asyncHandler(async (req) => {
  const data = await getTask(req.params.id, req.user.id);
  return ['Task', data];
}));

router.post('/tasks/:id/pause', authorize('user'), asyncHandler(async (req) => {
  const data = await pauseTask(req.params.id, req.user.id);
  return ['Paused', data];
}));

router.post('/tasks/pause-all', authorize('user'), asyncHandler(async (req) => {
  const data = await pauseAllTasks(req.user.id);
  return ['Paused', data];
}));

router.post('/tasks/:id/resume', authorize('user'), asyncHandler(async (req) => {
  const data = await resumeTask(req.params.id, req.user.id);
  return ['Resumed', data];
}));

router.post('/tasks/resume-all', authorize('user'), asyncHandler(async (req) => {
  const data = await resumeAllTasks(req.user.id);
  return ['Resumed', data];
}));

router.post('/tasks/:id/cancel', authorize('user'), asyncHandler(async (req) => {
  const data = await cancelTask(req.params.id, req.user.id);
  return ['Canceled', data];
}));

router.post('/tasks/clear', authorize('user'), asyncHandler(async (req) => {
  const data = await clearTasks(req.user.id, req.body?.statuses);
  return ['Cleared', data];
}));

router.delete('/tasks/:id', authorize('user'), asyncHandler(async (req) => {
  const data = await deleteTask(req.params.id, req.user.id);
  return ['Deleted', data];
}));

module.exports = router;
