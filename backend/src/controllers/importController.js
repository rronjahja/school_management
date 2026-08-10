const { importContract, checkExisting } = require('../services/contractImportService');
const { httpError } = require('../middleware/errorHandler');

/** POST /import/contract — trupi është vetë skedari .docx (binary). */
async function contract(req, res, next) {
  try {
    if (!Buffer.isBuffer(req.body) || req.body.length < 100) {
      throw httpError(400, 'Ngarkoni një skedar .docx të kontratës.');
    }
    // Nje header i keqformuar hedh URIError; pa kete, nje emer skedari i
    // gabuar do te dilte si «gabim ne server» ne vend te emrit te pastruar.
    const raw = req.get('X-Filename') || 'kontrata.docx';
    let filename;
    try { filename = decodeURIComponent(raw); } catch { filename = raw; }
    const r = await importContract(req.body, filename);
    const who = [r.data && r.data.first_name, r.data && r.data.last_name]
      .filter(Boolean).join(' ');
    res.locals.logSummary =
      `U lexua kontrata «${filename}»${who ? ` — ${who}` : ''}`
      + `${r.existing ? ' (numri i kontratës ekziston tashmë)' : ''}`;
    res.json(r);
  } catch (err) { next(err); }
}

/** POST /import/check-existing { numbers: [...] } — për rifreskim liste. */
async function existing(req, res, next) {
  try {
    res.json(await checkExisting(req.body && req.body.numbers));
  } catch (err) { next(err); }
}

module.exports = { contract, existing };