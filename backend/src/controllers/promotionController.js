const promotionService = require('../services/promotionService');

async function overview(req, res, next) {
  try {
    res.json({
      current_generation: promotionService.currentGeneration(),
      generations: await promotionService.listGenerations(),
      history: await promotionService.listPromotions(),
    });
  } catch (err) { next(err); }
}

async function preview(req, res, next) {
  try {
    res.json(await promotionService.preview(req.query.from_generation));
  } catch (err) { next(err); }
}

async function run(req, res, next) {
  try {
    const r = await promotionService.promote(req.body);
    res.locals.logEntityId = r.to_generation;
    res.locals.logSummary =
      `Kalimi i vitit ${r.from_generation} → ${r.to_generation}: `
      + `${r.promoted} nxënës kaluan, ${r.graduated} u diplomuan`;
    res.json(r);
  } catch (err) { next(err); }
}

module.exports = { overview, preview, run };