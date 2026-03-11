const crypto = require('crypto');
const { normalizeHttpStatus, normalizeMsg } = require('./tooljs');

const sendResponse = (res, success, msg, data = null, status = 200) => {
  res.status(normalizeHttpStatus(status)).json({ success, msg: normalizeMsg(msg), data });
};

// Simplified handler that expects fn to return [message, data] or just data
const asyncHandler = (fn) => async (req, res, next) => {
    try {
        const result = await fn(req, res, next);
        if (res.headersSent) return;
        
        // Handle Buffer response (File download/preview)
        if (result && typeof result === 'object' && Buffer.isBuffer(result.buffer)) {
            const { buffer, mimeType, name } = result;
            
            // Generate ETag for negotiation cache
            const etag = `"${crypto.createHash('md5').update(buffer).digest('hex')}"`;
            res.setHeader('ETag', etag);

            // Check If-None-Match
            if (req.headers['if-none-match'] === etag) {
                return res.status(304).end();
            }
            
            if (!res.getHeader('Content-Type')) {
                res.setHeader('Content-Type', mimeType || 'application/octet-stream');
            }
            
            if (!res.getHeader('Content-Length')) {
                res.setHeader('Content-Length', buffer.length);
            }

            if (name && !res.getHeader('Content-Disposition')) {
                res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(name)}"`);
            }

            return res.send(buffer);
        }

        if (Array.isArray(result) && typeof result[0] === 'string') {
            sendResponse(res, true, result[0], result[1]);
        } else {
            sendResponse(res, true, 'Success', result);
        }
    } catch (err) {
        sendResponse(res, false, err);
    }
};

module.exports = {
  sendResponse,
  asyncHandler
};
