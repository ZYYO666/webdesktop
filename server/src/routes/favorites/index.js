const express = require('express');
const router = express.Router();
const authorize = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/response');
const { listFavorites, addFavorite, removeFavorite } = require('./service');

// Get all favorites for the current user
router.get('/', authorize('user'), asyncHandler(async (req) => {
  const results = await listFavorites(req.user.id);
  return ['Favorites retrieved', results];
}));

// Add a favorite
router.post('/', authorize('user'), asyncHandler(async (req) => {
  const { path: filePath } = req.body;
  const result = await addFavorite(filePath, req.user.id);
  if (result.alreadyExists) {
      return ['Already in favorites'];
  }
  return ['Added to favorites', result];
}));

// Remove a favorite
router.delete('/', authorize('user'), asyncHandler(async (req) => {
    const { path: filePath } = req.query; // or req.body
    await removeFavorite(filePath, req.user.id);
    return ['Removed from favorites'];
}));

module.exports = router;