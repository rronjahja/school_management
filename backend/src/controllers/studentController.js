const studentService = require('../services/studentService');
const financeService = require('../services/financeService');
const { validateStudent } = require('../utils/validateStudent');

async function list(req, res, next) {
  try {
    const { search, category_id, payment_plan, study_year, status } = req.query;
    const students = await financeService.listStudentsWithFinance({
      search, category_id, payment_plan, study_year, status,
    });
    res.json(students);
  } catch (err) { next(err); }
}

async function detail(req, res, next) {
  try {
    res.json(await financeService.getStudentDetail(req.params.id));
  } catch (err) { next(err); }
}

async function nextContractNumber(req, res, next) {
  try {
    const { category_id, generation, enrollment_date } = req.query;
    if (!category_id) return res.json({ contract_number: '' });

    res.json({
      contract_number: await studentService.nextContractNumber(
        category_id, generation, enrollment_date
      ),
    });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const errors = validateStudent(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    const id = await studentService.createStudent(req.body, {
      // vetem administratoret (p.sh. migrimi i kontratave) mund ta mbajne
      // kuoten e kontrates edhe kur drejtimi ka kuote te konfiguruar
      allowQuotaOverride: req.user && req.user.role === 'admin',
    });
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

module.exports = { list, detail, create, update, remove, nextContractNumber };