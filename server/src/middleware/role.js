const { sendResponse } = require('../utils/response');

const requireRole = (minRole) => {
  return (req, res, next) => {
    // If no user is logged in (req.user is undefined) and the required role is not 'guest'
    if (!req.user && minRole !== 'guest') {
      return sendResponse(res, false, 'Login required', null, 401);
    }

    const userRole = req.user ? req.user.role : 'guest';
    const roles = ['guest', 'user', 'admin'];
    const userRoleIndex = roles.indexOf(userRole);
    const minRoleIndex = roles.indexOf(minRole);

    if (userRoleIndex >= minRoleIndex) {
      next();
    } else {
      sendResponse(res, false, 'Access denied');
    }
  };
};

module.exports = requireRole;
