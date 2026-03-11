const express = require('express');
const authorize = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/response');
const service = require('./service');

const router = express.Router();

router.use(authorize('admin'));

router.get('/runtime', asyncHandler(async () => {
  const data = await service.getRuntime();
  return ['Runtime', data];
}));

router.get('/templates', asyncHandler(async () => {
  const data = await service.listTemplates();
  return ['Templates', data];
}));

router.get('/containers', asyncHandler(async () => {
  const data = await service.listContainers();
  return ['Containers', data];
}));

router.get('/containers/:ref/inspect', asyncHandler(async (req) => {
  const data = await service.inspectContainer(req.params?.ref);
  return ['Container', data];
}));

router.post('/containers/:ref/action', asyncHandler(async (req) => {
  const data = await service.containerAction(req.params?.ref, req.body?.action);
  return ['Containers', data];
}));

router.delete('/containers/:ref', asyncHandler(async (req) => {
  const data = await service.removeContainer(req.params?.ref, req.query?.force);
  return ['Containers', data];
}));

router.get('/containers/:ref/logs', asyncHandler(async (req) => {
  const data = await service.containerLogs(req.params?.ref, req.query?.tail);
  return ['Logs', data];
}));

router.get('/containers/:ref/stats', asyncHandler(async (req) => {
  const data = await service.containerStats(req.params?.ref);
  return ['Stats', data];
}));

router.get('/containers/:ref/top', asyncHandler(async (req) => {
  const data = await service.containerTop(req.params?.ref);
  return ['Top', data];
}));

router.post('/containers/:ref/exec', asyncHandler(async (req) => {
  const data = await service.containerExec(req.params?.ref, req.body || {});
  return ['Exec', data];
}));

router.post('/containers/:ref/labels', asyncHandler(async (req) => {
  const data = await service.updateContainerLabels(req.params?.ref, req.body || {});
  return ['Containers', data];
}));

router.post('/containers/:ref/recreate', asyncHandler(async (req) => {
  const data = await service.recreateContainer(req.params?.ref, req.body || {});
  return ['Recreated', data];
}));

router.post('/containers/run', asyncHandler(async (req) => {
  const data = await service.runContainer(req.body || {});
  return ['Started', data];
}));

router.get('/install-jobs', asyncHandler(async (req) => {
  const data = await service.listInstallJobs(req.user.id, req.query?.limit, req.query?.projectKey ?? req.query?.project_path ?? req.query?.projectPath);
  return ['Jobs', data];
}));

router.get('/install-jobs/:id', asyncHandler(async (req) => {
  const data = await service.getInstallJob(req.user.id, req.params?.id);
  return ['Job', data];
}));

router.post('/install-jobs', asyncHandler(async (req) => {
  const data = await service.createInstallJob(req.user.id, req.body?.templateId, req.body?.overrides || {});
  return ['Job created', data];
}));

router.post('/install-jobs/:id/cancel', asyncHandler(async (req) => {
  const data = await service.cancelInstallJob(req.user.id, req.params?.id);
  return ['Canceled', data];
}));

router.delete('/install-jobs/:id', asyncHandler(async (req) => {
  const data = await service.deleteInstallJob(req.user.id, req.params?.id);
  return ['Deleted', data];
}));

router.get('/images', asyncHandler(async () => {
  const data = await service.listImages();
  return ['Images', data];
}));

router.post('/images/pull', asyncHandler(async (req) => {
  const data = await service.pullImage(req.body?.image);
  return ['Pulled', data];
}));

module.exports = router;
