const registerService = require('../services/registerService');

/**
 * Ditari i klasës. Kontrolluesit janë të hollë: logjika dhe kontrolli i
 * qasjes jetojnë te registerService. Këtu vendosen vetëm përmbledhjet
 * shqip për ditarin e veprimeve (res.locals.logSummary), që regjistrimi
 * i middleware-it të lexohet si fjali, jo si URL.
 */

const fullName = (s) => `${s.first_name} ${s.last_name}`;

// ---- Paralelet ----

async function listClasses(req, res, next) {
  try { res.json(await registerService.listClasses(req.user)); } catch (err) { next(err); }
}

async function classOptions(req, res, next) {
  try { res.json(await registerService.classOptions()); } catch (err) { next(err); }
}

async function createClass(req, res, next) {
  try {
    const cls = await registerService.createClass(req.body);
    res.locals.logEntityId = cls.id;
    res.locals.logSummary = `Paralelja ${cls.label} (${cls.school_year}) u krijua`;
    res.status(201).json(cls);
  } catch (err) { next(err); }
}

async function updateClass(req, res, next) {
  try {
    const cls = await registerService.updateClass(req.params.id, req.body);
    res.locals.logSummary = `Paralelja ${cls.label} (${cls.school_year}) u përditësua`;
    res.json(cls);
  } catch (err) { next(err); }
}

async function removeClass(req, res, next) {
  try {
    const cls = await registerService.deleteClass(req.params.id);
    res.locals.logSummary = `Paralelja ${cls.label} (${cls.school_year}) u fshi`;
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ---- Ditari i plotë ----

async function getRegister(req, res, next) {
  try { res.json(await registerService.getRegister(req.user, req.params.id)); } catch (err) { next(err); }
}

// ---- Lëndët ----

async function addSubject(req, res, next) {
  try {
    const { subject, class: cls } = await registerService.addSubject(req.user, req.params.id, req.body);
    res.locals.logEntityId = subject.id;
    res.locals.logSummary = `Lënda «${subject.name}» u shtua në paralelen ${cls.label}`;
    res.status(201).json(subject);
  } catch (err) { next(err); }
}

async function updateSubject(req, res, next) {
  try {
    const { subject, class: cls } = await registerService.updateSubject(req.user, req.params.id, req.body);
    res.locals.logSummary = `Lënda «${subject.name}» u përditësua (paralelja ${cls.label})`;
    res.json(subject);
  } catch (err) { next(err); }
}

async function removeSubject(req, res, next) {
  try {
    const { subject, class: cls, deactivated } = await registerService.removeSubject(req.user, req.params.id);
    res.locals.logSummary = deactivated
      ? `Lënda «${subject.name}» u çaktivizua — kishte nota (paralelja ${cls.label})`
      : `Lënda «${subject.name}» u fshi (paralelja ${cls.label})`;
    res.json({ ok: true, deactivated });
  } catch (err) { next(err); }
}

// ---- Notat ----

async function addGrade(req, res, next) {
  try {
    const r = await registerService.addGrade(req.user, req.params.id, req.body);
    res.locals.logEntityId = r.grade.id;
    res.locals.logSummary =
      `Nota ${r.grade.value} — ${fullName(r.student)} · ${r.subject.name} (${r.term_label}) · ${r.class.label}`;
    res.status(201).json(r.grade);
  } catch (err) { next(err); }
}

async function removeGrade(req, res, next) {
  try {
    const r = await registerService.removeGrade(req.user, req.params.id);
    res.locals.logSummary =
      `U fshi nota ${r.grade.value} — ${r.grade.student_name} · ${r.grade.subject_name} (${r.term_label}) · ${r.class.label}`;
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function setFinalGrade(req, res, next) {
  try {
    const r = await registerService.setFinalGrade(req.user, req.params.id, req.body);
    res.locals.logSummary = r.removed
      ? `U hoq mbyllja (${r.term_label}) — ${fullName(r.student)} · ${r.subject.name} · ${r.class.label}`
      : `${r.term_label}: ${r.value} — ${fullName(r.student)} · ${r.subject.name} · ${r.class.label}`;
    res.json({ ok: true, term: r.term, value: r.value });
  } catch (err) { next(err); }
}

// ---- Mungesat / sjellja / vërejtja ----

async function saveMeta(req, res, next) {
  try {
    const r = await registerService.saveStudentMeta(req.user, req.params.id, req.params.studentId, req.body);
    res.locals.logEntityId = req.params.studentId;
    res.locals.logSummary =
      `Mungesat/sjellja/vërejtja u përditësuan — ${fullName(r.student)} · ${r.class.label}`;
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function saveOrder(req, res, next) {
  try {
    const r = await registerService.saveStudentOrder(req.user, req.params.id, req.body.student_ids);
    res.locals.logEntityId = req.params.id;
    res.locals.logSummary = `Rendi i ${r.count} nxënësve u ndryshua — paralelja ${r.class.label}`;
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ---- Kontrolli i notave ----

async function reviewGrade(req, res, next) {
  try {
    const r = await registerService.reviewGrade(req.user, req.params.id, req.body);
    res.locals.logEntityId = r.id;
    const cila = `${fullName(r.student)} · ${r.subject.name} (${r.term_label}) · ${r.class.label}`;
    res.locals.logSummary = r.status === 'error'
      ? `Gabim i shënuar te nota ${r.value} — ${cila}: «${r.comment}»`
      : `Nota ${r.value} u pranua si e saktë — ${cila}`;
    res.status(201).json({ ok: true, id: r.id, status: r.status });
  } catch (err) { next(err); }
}

async function availableSubjects(req, res, next) {
  try { res.json(await registerService.listAvailableSubjects(req.params.id)); }
  catch (err) { next(err); }
}

module.exports = {
  availableSubjects,
  listClasses,
  classOptions,
  createClass,
  updateClass,
  removeClass,
  getRegister,
  addSubject,
  updateSubject,
  removeSubject,
  addGrade,
  removeGrade,
  setFinalGrade,
  saveMeta,
  saveOrder,
  reviewGrade,
};