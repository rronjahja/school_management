const studentService = require('../services/studentService');
const financeService = require('../services/financeService');
const { canSeeFinance } = require('../middleware/auth');
const { can } = require('../config/roles');
const { stripStudentFinance, stripListFinance } = require('../utils/redactFinance');
const { validateStudent } = require('../utils/validateStudent');

async function list(req, res, next) {
  try {
    const { search, category_id, payment_plan, study_year, status, page, limit } = req.query;
    const filters = { search, category_id, payment_plan, study_year, status };
    const hide = !canSeeFinance(req.user);   // stafi i sheh nxenesit, jo shifrat

    // Me `limit` kthehet nje faqe me numrin e pergjithshem; pa te, lista e
    // plote — si me pare. Keshtu faqet qe ende s'jane faqosur (Financat,
    // Te diplomuarit) vazhdojne te punojne pa asnje ndryshim.
    if (limit) {
      const result = await financeService.listStudentsPage({ ...filters, page, limit });
      return res.json(hide ? { ...result, rows: stripListFinance(result.rows) } : result);
    }

    const students = await financeService.listStudentsWithFinance(filters);
    return res.json(hide ? stripListFinance(students) : students);
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
      // Kuota e drejtimit eshte rregulli; ndryshimi me dore eshte perjashtimi.
      // Sipas politikes se kolegjit, kete perjashtim e bejne ata qe
      // regjistrojne nxenes: stafi, menaxheri dhe administratori.
      allowQuotaOverride: can(req.user, 'register'),
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