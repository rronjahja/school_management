const studentService = require('../services/studentService');
const financeService = require('../services/financeService');
const { canSeeFinance, isManager } = require('../middleware/auth');
const { stripStudentFinance, stripListFinance } = require('../utils/redactFinance');
const { validateStudent } = require('../utils/validateStudent');

async function list(req, res, next) {
  try {
    const { search, category_id, payment_plan, study_year, status } = req.query;
    const students = await financeService.listStudentsWithFinance({
      search, category_id, payment_plan, study_year, status,
    });
    // Stafi i sheh nxenesit, jo shifrat e tyre
    res.json(canSeeFinance(req.user) ? students : stripListFinance(students));
  } catch (err) { next(err); }
}

async function detail(req, res, next) {
  try {
    const student = await financeService.getStudentDetail(req.params.id);
    res.json(canSeeFinance(req.user) ? student : stripStudentFinance(student));
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
      allowQuotaOverride: isManager(req.user),
    });
    const created = await financeService.getStudentDetail(id);
    res.locals.logEntityId = id;
    res.locals.logSummary = `Nxënësi u regjistrua: ${created.first_name} ${created.last_name}`;
    res.status(201).json(created);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const errors = validateStudent(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    await studentService.updateStudent(req.params.id, req.body);
    const student = await financeService.getStudentDetail(req.params.id);
    res.locals.logSummary = `Nxënësi u përditësua: ${student.first_name} ${student.last_name}`;
    res.json(canSeeFinance(req.user) ? student : stripStudentFinance(student));
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    // Emri lexohet PARA fshirjes — pas saj s'ka me cfare te shkruhet ne ditar
    let who = '';
    try {
      const s = await financeService.getStudentDetail(req.params.id);
      who = `: ${s.first_name} ${s.last_name}`;
    } catch { /* nese s'gjendet, vazhdojme pa emer */ }

    await studentService.deleteStudent(req.params.id);
    res.locals.logSummary = `Nxënësi u fshi${who}`;
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = { list, detail, create, update, remove, nextContractNumber };