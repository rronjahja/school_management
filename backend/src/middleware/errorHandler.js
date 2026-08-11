/**
 * Perkthen perplasjet e kufizimeve UNIQUE ne shqip.
 *
 * Nese nje dublikat i shpeton kontrollit ne kod (dy kerkesa ne te njejtin
 * cast), MySQL e ndalon me ER_DUP_ENTRY — nje gabim pa `status`, qe do te
 * trajtohej si 500 dhe perdoruesi do te shihte «Ndodhi nje gabim ne server».
 * Ketu kthehet ne 409 me nje mesazh qe thote SE CILA vlere perseritet.
 *
 * Kodi i MySQL-it nuk del kurre jashte: nderfaqes i dergohet kodi jone.
 */
const DUPLICATE_MESSAGES = {
  contract_number: 'Ky numër kontrate është i zënë nga një nxënës tjetër.',
  username: 'Ky emër përdoruesi është i zënë.',
  uq_installment: 'Ky këst ekziston tashmë për këtë nxënës.',
};

function duplicateMessage(err) {
  if (!err || err.code !== 'ER_DUP_ENTRY') return null;
  const text = String(err.message || '');
  const hit = Object.keys(DUPLICATE_MESSAGES).find((k) => text.includes(k));
  return hit
    ? DUPLICATE_MESSAGES[hit]
    : 'Kjo vlerë ekziston tashmë dhe nuk mund të përsëritet.';
}

/** Kap gabimet e pa-trajtuara dhe kthen pergjigje te qarte JSON. */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(`[API] ${req.method} ${req.originalUrl} ->`, err.message);

  const duplicate = duplicateMessage(err);
  if (duplicate) {
    return res.status(409).json({ error: duplicate, code: 'DUPLICATE' });
  }

  const status = err.status || 500;
  const body = {
    error:
      status === 500
        ? 'Ndodhi një gabim në server. Ju lutem provoni përsëri.'
        : err.message,
  };
  // Disa gabime nderfaqja duhet t'i njohe me siguri, jo duke lexuar tekstin
  // (qe ndryshon me perkthimin). Kodi shtohet vetem per gabimet TONA:
  // gabimet e MySQL-it e mbajne gjithashtu `code` (p.sh. ER_DUP_ENTRY) dhe
  // ai s'duhet te dale kurre jashte serverit.
  if (err.code && status < 500) body.code = err.code;
  return res.status(status).json(body);
}

/** Ndihmese per te krijuar gabime me status HTTP (dhe, sipas deshires, nje kod). */
function httpError(status, message, code = null) {
  const err = new Error(message);
  err.status = status;
  if (code) err.code = code;
  return err;
}

module.exports = { errorHandler, httpError, duplicateMessage };