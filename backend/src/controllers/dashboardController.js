const financeService = require('../services/financeService');
const { round2 } = require('../utils/finance');

/**
 * Statistikat e panelit:
 *  - totalet (studente, te arkëtuara, borxh)
 *  - shperndarja sipas drejtimeve
 *  - alarmet (te kuqe = vonesa, te verdha = afër afatit)
 */
async function stats(req, res, next) {
  try {
    const students = await financeService.listStudentsWithFinance(); // vetem aktivet
    const graduates = await financeService.listStudentsWithFinance({ status: 'graduated' });
    const graduatesInDebt = graduates.filter((g) => g.finance.balance > 0.005);

    const totals = {
      students: students.length,
      collected: round2(students.reduce((s, x) => s + x.finance.total_paid, 0)),
      outstanding: round2(students.reduce((s, x) => s + x.finance.balance, 0)),
      overdue: students.filter((x) => x.finance.status === 'overdue').length,
      dueSoon: students.filter((x) => x.finance.status === 'due-soon').length,
      graduates: graduates.length,
      graduatesInDebt: graduatesInDebt.length,
      graduatesDebt: round2(graduatesInDebt.reduce((s, x) => s + x.finance.balance, 0)),
    };

    const byCategory = {};
    students.forEach((s) => {
      const key = s.category_id;
      if (!byCategory[key]) {
        byCategory[key] = {
          category_id: s.category_id,
          name: s.category_name,
          color: s.category_color,
          students: 0,
          collected: 0,
          outstanding: 0,
        };
      }
      byCategory[key].students += 1;
      byCategory[key].collected = round2(byCategory[key].collected + s.finance.total_paid);
      byCategory[key].outstanding = round2(byCategory[key].outstanding + s.finance.balance);
    });

    const alerts = students
      .filter((s) => s.finance.status === 'overdue' || s.finance.status === 'due-soon')
      .sort((a, b) => {
        if (a.finance.status !== b.finance.status) {
          return a.finance.status === 'overdue' ? -1 : 1;
        }
        const da = a.finance.next_due ? a.finance.next_due.due_date : '';
        const db = b.finance.next_due ? b.finance.next_due.due_date : '';
        return da.localeCompare(db);
      });

    const recent = students.slice(0, 6);

    res.json({ totals, categories: Object.values(byCategory), alerts, recent });
  } catch (err) { next(err); }
}

module.exports = { stats };