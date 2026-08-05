const lessonService = require('../services/lessonService');

/**
 * Ditari i orëve të mësimit. Kontrolluesit të hollë; rregullat te
 * lessonService. Këtu vetëm përmbledhjet shqip për ditarin e veprimeve.
 */

const dmy = (iso) => String(iso).split('-').reverse().join('.');

async function listClasses(req, res, next) {
    try { res.json(await lessonService.listClasses(req.user)); } catch (err) { next(err); }
}

async function getMonth(req, res, next) {
    try {
        res.json(await lessonService.getMonth(req.user, req.params.id, req.query.month));
    } catch (err) { next(err); }
}

async function createLesson(req, res, next) {
    try {
        const r = await lessonService.createLesson(req.user, req.params.id, req.body);
        res.locals.logEntityId = r.id;
        const zev = r.substitute_for ? ' (zëvendësim)' : '';
        res.locals.logSummary =
            `Ora ${r.period}, ${dmy(r.lesson_date)} — ${r.subject_name}${zev} · ${r.class.label}`;
        res.status(201).json({ ok: true, id: r.id });
    } catch (err) { next(err); }
}

async function updateLesson(req, res, next) {
    try {
        const r = await lessonService.updateLesson(req.user, req.params.id, req.body);
        res.locals.logSummary =
            `U ndryshua ora ${r.period}, ${dmy(r.lesson_date)} — ${r.subject_name} · ${r.class.label}`;
        res.json({ ok: true });
    } catch (err) { next(err); }
}

async function deleteLesson(req, res, next) {
    try {
        const r = await lessonService.deleteLesson(req.user, req.params.id);
        res.locals.logSummary =
            `U fshi ora ${r.period}, ${dmy(String(r.lesson_date).slice(0, 10))} — ${r.subject_name} · ${r.class_label}`;
        res.json({ ok: true });
    } catch (err) { next(err); }
}

async function reviewLesson(req, res, next) {
    try {
        const r = await lessonService.reviewLesson(req.user, req.params.id, req.body);
        res.locals.logEntityId = r.id;
        const cila = `ora ${r.period}, ${dmy(String(r.lesson_date).slice(0, 10))} — ${r.subject_name} · ${r.class_label}`;
        res.locals.logSummary = r.review_status === 'error'
            ? `Gabim i shënuar te ${cila}: «${r.review_comment}»`
            : `U pranua ${cila}`;
        res.json({ ok: true, status: r.review_status });
    } catch (err) { next(err); }
}

async function monthlyReport(req, res, next) {
    try {
        res.json(await lessonService.monthlyReport(req.user, req.query.month, req.query.class_id));
    } catch (err) { next(err); }
}

module.exports = {
    listClasses, getMonth, createLesson, updateLesson, deleteLesson, reviewLesson, monthlyReport,
};