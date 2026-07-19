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
    res.json(await promotionService.promote(req.body));
  } catch (err) { next(err); }
}

module.exports = { overview, preview, run };