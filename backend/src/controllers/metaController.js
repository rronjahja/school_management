const settingsService = require('../services/settingsService');

// ---- lexim (per te gjithe perdoruesit e identifikuar) ----

async function categories(req, res, next) {
  try { res.json(await settingsService.listCategories()); } catch (err) { next(err); }
}

async function banks(req, res, next) {
  try { res.json(await settingsService.listBanks()); } catch (err) { next(err); }
}

// ---- ndryshim (vetem administratoret) ----
//
// Cdo ndryshim konfigurimi le nje pershkrim te lexueshem ne ditarin e
// veprimeve. «Banka u perditesua» s'i thote asgje kujt e lexon muaj me
// vone; «Banka «TEB Bank» u perditesua (llogaria 2011...)» po.

async function createBank(req, res, next) {
  try {
    const bank = await settingsService.createBank(req.body);
    res.locals.logEntityId = bank.id;
    res.locals.logSummary = `U shtua banka «${bank.name}»`;
    res.status(201).json(bank);
  } catch (err) { next(err); }
}

async function updateBank(req, res, next) {
  try {
    const bank = await settingsService.updateBank(req.params.id, req.body);
    res.locals.logEntityId = bank.id;
    res.locals.logSummary = `Banka «${bank.name}» u përditësua`;
    res.json(bank);
  } catch (err) { next(err); }
}

async function removeBank(req, res, next) {
  try {
    // Emri lexohet PARA fshirjes — pas saj s'ka me cfare te shkruhet.
    const before = (await settingsService.listBanks())
      .find((b) => String(b.id) === String(req.params.id));
    await settingsService.deleteBank(req.params.id);
    res.locals.logEntityId = req.params.id;
    res.locals.logSummary = `U fshi banka «${(before && before.name) || req.params.id}»`;
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function createCategory(req, res, next) {
  try {
    const cat = await settingsService.createCategory(req.body);
    res.locals.logEntityId = cat.id;
    res.locals.logSummary = `U shtua drejtimi «${cat.name}» (${cat.code})`;
    res.status(201).json(cat);
  } catch (err) { next(err); }
}

async function updateCategory(req, res, next) {
  try {
    const cat = await settingsService.updateCategory(req.params.id, req.body);
    res.locals.logEntityId = cat.id;
    const quota = cat.default_quota === null || cat.default_quota === undefined
      ? 'pa kuotë'
      : `kuota ${Number(cat.default_quota).toFixed(2)} €`;
    res.locals.logSummary = `Drejtimi «${cat.name}» (${cat.code}) u përditësua — ${quota}`;
    res.json(cat);
  } catch (err) { next(err); }
}

async function removeCategory(req, res, next) {
  try {
    const before = (await settingsService.listCategories())
      .find((c) => String(c.id) === String(req.params.id));
    await settingsService.deleteCategory(req.params.id);
    res.locals.logEntityId = req.params.id;
    res.locals.logSummary = `U fshi drejtimi «${(before && before.name) || req.params.id}»`;
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function reminderTemplate(req, res, next) {
  try { res.json(await settingsService.getReminderTemplate()); } catch (err) { next(err); }
}

async function saveReminderTemplate(req, res, next) {
  try {
    const r = await settingsService.setReminderTemplate(req.body.template);
    res.locals.logEntityId = 'reminder_template';
    res.locals.logSummary = r.is_default
      ? 'Teksti i rikujtesës u kthye në parazgjedhje'
      : 'Teksti i rikujtesës u ndryshua';
    res.json(r);
  } catch (err) { next(err); }
}

module.exports = {
  categories, banks, reminderTemplate, saveReminderTemplate,
  createBank, updateBank, removeBank,
  createCategory, updateCategory, removeCategory,
};