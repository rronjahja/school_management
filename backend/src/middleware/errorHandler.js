/** Kap gabimet e pa-trajtuara dhe kthen pergjigje te qarte JSON. */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(`[API] ${req.method} ${req.originalUrl} ->`, err.message);

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
  res.status(status).json(body);
}

/** Ndihmese per te krijuar gabime me status HTTP (dhe, sipas deshires, nje kod). */
function httpError(status, message, code = null) {
  const err = new Error(message);
  err.status = status;
  if (code) err.code = code;
  return err;
}

module.exports = { errorHandler, httpError };