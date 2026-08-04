const activityLog = require('../services/activityLogService');

/** GET /logs — kërkim me filtra (vetëm administratorët). */
async function list(req, res, next) {
    try {
        const { search, username, entity, action, from, to, page, limit } = req.query;
        res.json(await activityLog.list({ search, username, entity, action, from, to, page, limit }));
    } catch (err) { next(err); }
}

/** GET /logs/facets — vlerat e disponueshme për filtrat. */
async function facets(req, res, next) {
    try { res.json(await activityLog.facets()); } catch (err) { next(err); }
}

module.exports = { list, facets };