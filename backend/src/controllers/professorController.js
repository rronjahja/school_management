const professorService = require('../services/professorService');

/** Profesorët dhe lëndët — thirren nga faqja «Administrata». */

async function listSubjects(req, res, next) {
  try { res.json(await professorService.listSubjects()); } catch (err) { next(err); }
}

async function createSubject(req, res, next) {
  try {
    const s = await professorService.createSubject(req.body);
    res.locals.logEntityId = s.id;
    res.locals.logSummary = `U shtua lënda «${s.name}» në katalog`;
    res.status(201).json(s);
  } catch (err) { next(err); }
}

async function removeSubject(req, res, next) {
  try {
    const s = await professorService.deleteSubject(req.params.id);
    res.locals.logEntityId = s.id;
    res.locals.logSummary = `U fshi lënda «${s.name}» nga katalogu`;
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function setSubjectCategories(req, res, next) {
  try {
    const s = await professorService.setSubjectCategories(req.params.id, req.body.category_ids);
    res.locals.logEntityId = s.id;
    res.locals.logSummary = `U caktuan drejtimet për lëndën «${s.name}»`;
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try { res.json(await professorService.listProfessors()); } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const p = await professorService.createProfessor(req.body);
    res.locals.logEntityId = p.id;
    res.locals.logSummary = `U shtua profesori ${p.full_name}`;
    res.status(201).json({ ok: true, id: p.id });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const p = await professorService.updateProfessor(req.params.id, req.body);
    res.locals.logEntityId = p.id;
    res.locals.logSummary = `U përditësua profesori ${p.full_name}`;
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const p = await professorService.deleteProfessor(req.params.id);
    res.locals.logEntityId = p.id;
    res.locals.logSummary = `U fshi profesori ${p.full_name}`;
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = {
  listSubjects, createSubject, removeSubject, setSubjectCategories,
  list, create, update, remove,
};