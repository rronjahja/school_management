const authService = require('../services/authService');
const { COOKIE_NAME } = require('../config/auth');
const { httpError } = require('./errorHandler');

/**
 * Kerkon nje sesion te vlefshem.
 * Token-i lexohet nga cookie httpOnly — JavaScript-i i faqes nuk e prek dot.
 */
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies ? req.cookies[COOKIE_NAME] : null;
    if (!token) throw httpError(401, 'Nuk jeni i identifikuar.');

    const payload = authService.verifyToken(token);
    if (!payload) throw httpError(401, 'Sesioni ka skaduar. Hyni sërish.');

    // Verifikohet ne baze — llogaria mund te jete c'aktivizuar pas leshimit te token-it
    const user = await authService.getUserById(payload.sub);
    if (!user) throw httpError(401, 'Llogaria nuk është më aktive.');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** Vetem administratoret. */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(httpError(403, 'Ky veprim kërkon të drejta administratori.'));
  }
  next();
}

/**
 * Mbrojtje shtese nga CSRF.
 * Cookie eshte SameSite=strict, por kerkojme edhe nje header te posacem:
 * shfletuesi nuk e lejon nje faqe te huaj ta shtoje ate pa leje CORS.
 */
function requireXhrHeader(req, res, next) {
  const safe = ['GET', 'HEAD', 'OPTIONS'];
  if (safe.includes(req.method)) return next();

  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    return next(httpError(403, 'Kërkesa u refuzua (mbrojtje CSRF).'));
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireXhrHeader };