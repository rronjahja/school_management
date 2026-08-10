const authService = require('../services/authService');

async function list(req, res, next) {
  try { res.json(await authService.listUsers()); } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const u = await authService.createUser(req.body);
    res.locals.logEntityId = u.id;
    res.locals.logSummary = `U krijua përdoruesi ${u.username} (${u.role}) — ${u.full_name}`;
    res.status(201).json(u);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const u = await authService.updateUser(req.params.id, req.body, req.user.id);
    res.locals.logEntityId = u.id;
    // Cfare ndryshoi thuhet me emer: «u caktivizua» eshte me e dobishme se
    // «Perdoruesi u perditesua» kur ditari lexohet muaj me vone.
    const parts = [];
    if (req.body.role !== undefined) parts.push(`roli → ${u.role}`);
    if (req.body.is_active !== undefined) parts.push(u.is_active ? 'u aktivizua' : 'u çaktivizua');
    if (req.body.full_name !== undefined) parts.push(`emri → ${u.full_name}`);
    res.locals.logSummary = parts.length
      ? `Përdoruesi ${u.username}: ${parts.join(', ')}`
      : `Përdoruesi ${u.username} u përditësua`;
    res.json(u);
  } catch (err) { next(err); }
}

async function resetPassword(req, res, next) {
  try {
    await authService.resetPassword(req.params.id, req.body.new_password);
    const u = await authService.getUserById(req.params.id);
    res.locals.logEntityId = req.params.id;
    res.locals.logSummary =
      `Fjalëkalim i përkohshëm për ${(u && u.username) || `#${req.params.id}`} `
      + '— do ta zëvendësojë vetë në hyrjen e ardhshme';
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = { list, create, update, resetPassword };