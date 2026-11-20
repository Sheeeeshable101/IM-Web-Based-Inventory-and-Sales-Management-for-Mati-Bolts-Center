const jwt = require('jsonwebtoken');
const db = require('../db');

function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET);
    db.execute(
      db.client.from('user').select('id, name, username, role, active').eq('id', claims.id).maybeSingle()
    ).then((user) => {
      if (!user || !user.active) {
        return res.status(401).json({ error: 'Your account is inactive or no longer exists.' });
      }
      req.user = { id: user.id, name: user.name, username: user.username, role: user.role };
      return next();
    }).catch(next);
    return undefined;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Your session is invalid or has expired. Please sign in again.' });
    }
    return next(error);
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Administrator access is required.' });
  }
  return next();
}

module.exports = { requireAuth, requireAdmin };
