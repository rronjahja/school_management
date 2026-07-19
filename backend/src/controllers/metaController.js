const settingsService = require('../services/settingsService');

// ---- lexim (per te gjithe perdoruesit e identifikuar) ----

async function categories(req, res, next) {
  try { res.json(await settingsService.listCategories()); } catch (err) { next(err); }
}

async function banks(req, res, next) {
  try { res.json(await settingsService.listBanks()); } catch (err) { next(err); }
}

// ---- ndryshim (vetem administratoret) ----

async function createBank(req, res, next) {
  try { res.status(201).json(await settingsService.createBank(req.body)); } catch (err) { next(err); }
}

async function updateBank(req, res, next) {
  try { res.json(await settingsService.updateBank(req.params.id, req.body)); } catch (err) { next(err); }
}

async function removeBank(req, res, next) {
  try {
    await settingsService.deleteBank(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function createCategory(req, res, next) {
  try { res.status(201).json(await settingsService.createCategory(req.body)); } catch (err) { next(err); }
}

async function updateCategory(req, res, next) {
  try { res.json(await settingsService.updateCategory(req.params.id, req.body)); } catch (err) { next(err); }
}

async function removeCategory(req, res, next) {
  try {
    await settingsService.deleteCategory(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = {
  categories, banks,
  createBank, updateBank, removeBank,
  createCategory, updateCategory, removeCategory,
};