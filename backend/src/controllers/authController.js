const authService = require('../services/authService');
const activityLog = require('../services/activityLogService');
const { COOKIE_NAME, cookieOptions } = require('../config/auth');

const clientIp = (req) => req.ip || (req.socket && req.socket.remoteAddress) || null;

async function login(req, res, next) {
  const { username, password } = req.body;
  try {
    const { token, user } = await authService.login(username, password, req);

    // Hyrja regjistrohet KETU: middleware-i i ditarit vepron pas requireAuth,
    // ndersa hyrja ndodh perpara saj — perndryshe s'do te shihej fare.
    activityLog.record({
      user,
      action: 'login',
      entity: 'auth',
      entity_id: String(user.id),
      summary: `${user.full_name || user.username} hyri në sistem`,
      method: req.method,
      path: req.originalUrl,
      status_code: 200,
      ip: clientIp(req),
    });

    res.cookie(COOKIE_NAME, token, cookieOptions);
    res.json({ user });
  } catch (err) {
    // Perpjekjet e deshtuara kane vlere sigurie — ruhen edhe pse s'ndryshuan asgje
    activityLog.record({
      username: String(username || '').slice(0, 60) || 'i panjohur',
      action: 'login-failed',
      entity: 'auth',
      summary: `Përpjekje e dështuar për hyrje: ${String(username || '—').slice(0, 40)}`,
      method: req.method,
      path: req.originalUrl,
      status_code: err.status || 401,
      ip: clientIp(req),
    });
    next(err);
  }
}

function logout(req, res) {
  activityLog.record({
    user: req.user,
    action: 'logout',
    entity: 'auth',
    entity_id: req.user ? String(req.user.id) : null,
    summary: `${(req.user && (req.user.full_name || req.user.username)) || 'Përdoruesi'} doli nga sistemi`,
    method: req.method,
    path: req.originalUrl,
    status_code: 200,
    ip: clientIp(req),
  });
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
}

async function me(req, res) {
  res.json({ user: req.user });
}

/** Publike: tregon nese ekziston ndonje llogari (per faqen e hyrjes). */
async function status(req, res, next) {
  try {
    res.json({ has_users: await authService.hasUsers() });
  } catch (err) { next(err); }
}

async function changePassword(req, res, next) {
  try {
    const { current_password, new_password } = req.body;
    await authService.changeOwnPassword(req.user.id, current_password, new_password);
    // Perdoruesi i freskuar kthehet bashke me pergjigjen: nderfaqja e heq
    // ekranin e detyruar pa pasur nevoje per nje kerkese te dyte.
    const user = await authService.getUserById(req.user.id);
    res.locals.logEntityId = String(req.user.id);
    res.locals.logSummary =
      `${req.user.full_name || req.user.username} ndryshoi fjalëkalimin e vet`;
    res.json({ ok: true, user });
  } catch (err) { next(err); }
}

module.exports = { login, logout, me, status, changePassword };