const documentService = require('../services/documentService');

async function listTemplates(req, res, next) {
  try {
    res.json(documentService.listTemplates());
  } catch (err) { next(err); }
}

async function generate(req, res, next) {
  try {
    const { buffer, filename } = await documentService.generateDocument(
      req.params.id,
      req.query.template // opsionale; pa te merret shablloni i pare
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.locals.logEntityId = req.params.id;
    res.locals.logSummary = `U gjenerua dokumenti «${filename}»`;
    res.send(buffer);
  } catch (err) { next(err); }
}

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function sendDocx(res, { buffer, filename }) {
  res.setHeader('Content-Type', DOCX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.send(buffer);
}

/** GET /payments/:id/fletepagesa — fleta e një pagese të bërë */
async function paymentSlip(req, res, next) {
  try {
    const doc = await documentService.paymentSlip(Number(req.params.id));
    res.locals.logEntityId = req.params.id;
    res.locals.logSummary = `Fletëpagesa e pagesës #${req.params.id} u shkarkua`;
    sendDocx(res, doc);
  } catch (err) { next(err); }
}

/** GET /students/:id/fletepagesa — fleta e detyrimeve (për rikujtesën) */
async function reminderSlip(req, res, next) {
  try {
    // ?keste=0,1,2 — bosh do te thote "detyrimet e vonuara"
    const raw = String(req.query.keste || '').trim();
    const seqs = raw
      ? raw.split(',').map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 0)
      : null;
    const doc = await documentService.reminderSlip(Number(req.params.id), seqs);
    res.locals.logEntityId = req.params.id;
    res.locals.logSummary =
      `Fletëpagesa e detyrimeve për nxënësin #${req.params.id} u shkarkua`;
    sendDocx(res, doc);
  } catch (err) { next(err); }
}

module.exports = {
  paymentSlip, reminderSlip, listTemplates, generate };