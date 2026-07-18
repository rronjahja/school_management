const studentService = require('../services/studentService');
const financeService = require('../services/financeService');
const { validateStudent } = require('../utils/validateStudent');

async function list(req, res, next) {
  try {
    const { search, category_id, payment_plan } = req.query;
    const students = await financeService.listStudentsWithFinance({ search, category_id, payment_plan });
    res.json(students);
  } catch (err) { next(err); }
}

async function detail(req, res, next) {
  try {
    res.json(await financeService.getStudentDetail(req.params.id));
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const errors = validateStudent(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    const id = await studentService.createStudent(req.body);
    res.status(201).json(await financeService.getStudentDetail(id));
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const errors = validateStudent(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    await studentService.updateStudent(req.params.id, req.body);
    res.json(await financeService.getStudentDetail(req.params.id));
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await studentService.deleteStudent(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = { list, detail, create, update, remove };
