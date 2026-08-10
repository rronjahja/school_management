const activityLog = require('../services/activityLogService');

/**
 * Regjistron ÇDO kërkesë që ndryshon të dhëna, plus leximet që nxjerrin
 * të dhëna jashtë sistemit (eksporti, kontrata, fletëpagesa).
 *
 * Vendoset një herë te routes/index.js dhe kap gjithçka — asnjë kontroller
 * s'ka nevojë të mbajë mend të shkruajë në ditar. Kështu një veçori e re
 * regjistrohet vetvetiu, pa u harruar.
 *
 * PSE REGJISTROHEN EDHE DËSHTIMET: më parë shkruheshin vetëm veprimet me
 * sukses. Por një përpjekje e ndaluar — dikush që provon të fshijë një
 * nxënës pa të drejtë, ose një pagesë e refuzuar — është pikërisht ajo që
 * kërkohet më vonë te ditari. Statusi ruhet te `status_code`, kështu që
 * nderfaqja i dallon me një shenjë dhe i filtron veçmas.
 */

/** Fushat qe nuk duhet te perfundojne kurre ne ditar. */
const SECRET_FIELDS = [
  'password', 'new_password', 'current_password', 'password_hash', 'token',
];

function safeBody(body) {
  if (!body || typeof body !== 'object' || Buffer.isBuffer(body)) return null;
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (SECRET_FIELDS.includes(k)) continue;         // fjalëkalimet kurrë
    if (v === null || v === undefined || v === '') continue;
    if (typeof v === 'object') continue;             // struktura te medha nuk ndihmojne
    out[k] = String(v).slice(0, 120);
  }
  return Object.keys(out).length ? out : null;
}

function activityLogger(req, res, next) {
  const info = activityLog.classify(req.method, req.originalUrl);
  if (!info) return next();                          // shfletimi i zakonshëm

  res.on('finish', () => {
    // Te leximet e regjistruara, «çfarë u kërkua» rri te query-ja, jo te trupi.
    const payload = req.method === 'GET' ? req.query : req.body;

    activityLog.record({
      user: req.user,
      action: info.action,
      entity: info.entity,
      // Id-ja e krijuar rishtas nuk gjendet te URL-ja; kontrolleret e vendosin
      // te res.locals.logEntityId kur e dine.
      entity_id: res.locals.logEntityId || info.entity_id,
      summary: res.locals.logSummary,
      details: safeBody(payload),
      method: req.method,
      path: String(req.originalUrl).slice(0, 255),
      status_code: res.statusCode,
      ip: req.ip || (req.socket && req.socket.remoteAddress) || null,
    });
  });

  next();
}

module.exports = { activityLogger, safeBody };