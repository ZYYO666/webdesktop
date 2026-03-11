const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const db = require('../config/db');
const { sendResponse } = require('../utils/response');
const { getSetting } = require('../utils/db-utils');

const roles = ['guest', 'user', 'admin'];

const authorize = (minRole = 'guest') => {
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];

    if (!token && req.query.token) token = req.query.token;
    if (!token && req.body?.token) token = req.body.token;

    const enforceRole = () => {
      const userRole = req.user?.role || 'guest';
      const userRoleIndex = roles.indexOf(userRole);
      const minRoleIndex = roles.indexOf(minRole);

      if (userRoleIndex >= minRoleIndex) return next();
      if (userRole === 'guest' && minRole !== 'guest') return sendResponse(res, false, 'Login required', null, 401);
      return sendResponse(res, false, 'Access denied');
    };

    if (!token) {
      req.user = { role: 'guest', username: 'guest', id: 0 };
      return enforceRole();
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        if (minRole === 'guest') {
          req.user = { role: 'guest', username: 'guest', id: 0 };
          return enforceRole();
        }
        return sendResponse(res, false, 'SESSION_EXPIRED', null, 401);
      }

      getSetting('enableSso', 'false').then((enableSso) => {
        if (enableSso !== 'true') {
          req.user = user;
          enforceRole();
          return;
        }

        db.get("SELECT current_token FROM users WHERE id = ?", [user.id], (dbErr, row) => {
          if (dbErr) return sendResponse(res, false, 'Server Error');
          if (!row || row.current_token !== token) {
            if (minRole === 'guest') {
              req.user = { role: 'guest', username: 'guest', id: 0 };
              return enforceRole();
            }
            return sendResponse(res, false, 'SESSION_EXPIRED', null, 401);
          }

          req.user = user;
          enforceRole();
        });
      }).catch(() => {
        req.user = user;
        enforceRole();
      });
    });
  };
};

module.exports = authorize;
