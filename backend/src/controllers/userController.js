const authService = require('../services/authService');

async function list(req, res, next) {
  try { res.json(await authService.listUsers()); } catch (err) { next(err); }
}

async function create(req, res, next) {
  try { res.status(201).json(await authService.createUser(req.body)); } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    res.json(await authService.updateUser(req.params.id, req.body, req.user.id));
  } catch (err) { next(err); }
}

async function resetPassword(req, res, next) {
  try {
    await authService.resetPassword(req.params.id, req.body.new_password);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = { list, create, update, resetPassword };