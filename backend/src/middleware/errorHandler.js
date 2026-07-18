/** Kap gabimet e pa-trajtuara dhe kthen pergjigje te qarte JSON. */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(`[API] ${req.method} ${req.originalUrl} ->`, err.message);

  const status = err.status || 500;
  res.status(status).json({
    error:
      status === 500
        ? 'Ndodhi një gabim në server. Ju lutem provoni përsëri.'
        : err.message,
  });
}

/** Ndihmese per te krijuar gabime me status HTTP. */
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = { errorHandler, httpError };
