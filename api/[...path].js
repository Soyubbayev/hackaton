const handler = require('../server');

module.exports = async function (req, res) {
  if (req.url && req.query && req.query.path !== undefined && !req.url.startsWith('/api/')) {
    const parts = Array.isArray(req.query.path) ? req.query.path : [req.query.path];
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    req.url = '/api/' + parts.join('/') + query;
  }
  return handler(req, res);
};
