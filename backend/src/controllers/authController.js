const authService = require('../services/authService');
const { COOKIE_NAME, cookieOptions } = require('../config/auth');

async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    const { token, user } = await authService.login(username, password, req);

    res.cookie(COOKIE_NAME, token, cookieOptions);
    res.json({ user });
  } catch (err) { next(err); }
}

function logout(req, res) {
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
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = { login, logout, me, status, changePassword };