const activityLog = require('../services/activityLogService');

/**
 * Ditari i veprimeve — vetëm lexim.
 *
 * KY SKEDAR ËSHTË I HOLLË ME QËLLIM. Në një commit të mëparshëm mbi të u
 * kopjua e gjithë përmbajtja e `activityLogService.js`, ndaj `list` dhe
 * `facets` u bënë funksione shërbimi me nënshkrimin `list({ filtra })`.
 * Express-i i thërret si `list(req, res, next)`: filtrat dilnin `undefined`
 * dhe — më keq — asnjë përgjigje nuk dërgohej kurrë. Kërkesa
 * `GET /api/logs` mbetej varur derisa shfletuesi të hiqte dorë, dhe faqja
 * «Ditari i veprimeve» ngelte bosh pa asnjë gabim që të tregonte pse.
 *
 * Mësimi: kontrolluesi përkthen HTTP -> shërbim dhe kthen përgjigje.
 * Logjika rri te shërbimi.
 */

/** GET /logs — kërkim me filtra. */
async function list(req, res, next) {
    try {
        const {
            search, username, entity, action, from, to, page, limit, only_failed,
        } = req.query;

        res.json(await activityLog.list({
            search, username, entity, action, from, to, page, limit, only_failed,
        }));
    } catch (err) { next(err); }
}

/** GET /logs/facets — vlerat e disponueshme për filtrat. */
async function facets(req, res, next) {
    try { res.json(await activityLog.facets()); } catch (err) { next(err); }
}

module.exports = { list, facets };