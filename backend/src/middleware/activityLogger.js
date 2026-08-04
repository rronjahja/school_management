const activityLog = require('../services/activityLogService');

/**
 * Regjistron ÇDO kërkesë që ndryshon të dhëna.
 *
 * Vendoset një herë te routes/index.js dhe kap gjithçka — asnjë kontroller
 * s'ka nevojë të mbajë mend të shkruajë në ditar. Kështu një veçori e re
 * regjistrohet vetvetiu, pa u harruar.
 *
 * Shkruan VETËM kur veprimi ka pasur sukses (statusi < 400): përpjekjet e
 * dështuara nuk kanë ndryshuar asgjë. Përjashtim bën hyrja e dështuar, që
 * regjistrohet veçmas te authService sepse ka vlerë sigurie.
 */

/** Fushat qe nuk duhet te perfundojne kurre ne ditar. */
const SECRET_FIELDS = ['password', 'new_password', 'current_password', 'password_hash', 'token'];

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
    if (!info) return next();                          // GET-et dhe rrugët pa lidhje

    res.on('finish', () => {
        if (res.statusCode >= 400) return;               // s'ndryshoi asgjë

        // Id-ja e krijuar rishtas nuk gjendet te URL-ja; kontrolleret e vendosin
        // te res.locals.logEntityId kur e dine.
        const entityId = res.locals.logEntityId || info.entity_id;

        activityLog.record({
            user: req.user,
            action: info.action,
            entity: info.entity,
            entity_id: entityId,
            summary: res.locals.logSummary,
            details: safeBody(req.body),
            method: req.method,
            path: String(req.originalUrl).slice(0, 255),
            status_code: res.statusCode,
            ip: req.ip || (req.socket && req.socket.remoteAddress) || null,
        });
    });

    next();
}

module.exports = { activityLogger, safeBody };