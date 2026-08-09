const pool = require('../config/db');
const studentService = require('./studentService');
const { summarizeFinance } = require('../utils/finance');

/** Lista e studenteve, secili me permbledhjen e tij financiare. */
async function listStudentsWithFinance(filters = {}) {
  const students = await studentService.listStudents(filters);
  const installments = await studentService.installmentsByStudent(students.map((s) => s.id));

  return students.map((s) => {
    const finance = summarizeFinance(s, installments[s.id] || [], s.total_paid);
    const { installments: _drop, ...summary } = finance; // lista e plote s'duhet ne tabela
    return { ...s, finance: summary };
  });
}

/**
 * Nje faqe e vetme nxenesish, me numrin e pergjithshem.
 *
 * Kursimi i vertete nuk eshte te rreshtat, por te kestet: me pare
 * merreshin kestet e TE GJITHE nxenesve per te llogaritur gjendjen
 * financiare te secilit, edhe pse ne ekran shiheshin njezet. Tani
 * lexohen vetem kestet e njezet nxenesve te faqes.
 */
async function listStudentsPage(filters = {}) {
  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 200);
  const wanted = Math.max(Number(filters.page) || 1, 1);

  const total = await studentService.countStudents(filters);
  const pages = Math.ceil(total / limit) || 1;
  // Nese filtri i ri e shkurton listen, faqja e kerkuar mund te mos
  // ekzistoje me — kthehemi te e fundit, jo te nje ekran bosh.
  const page = Math.min(wanted, pages);

  const rows = await listStudentsWithFinance({
    ...filters, limit, offset: (page - 1) * limit,
  });

  return { rows, total, page, limit, pages };
}

/** Detajet e plota te nje studenti: te dhenat, kestet, pagesat. */
async function getStudentDetail(id) {
  const student = await studentService.getStudentRow(id);

  const [installments] = await pool.query(
    'SELECT * FROM installments WHERE student_id = ? ORDER BY seq',
    [id]
  );
  const [payments] = await pool.query(
    `SELECT p.*, b.name AS bank_name
       FROM payments p
       LEFT JOIN banks b ON b.id = p.bank_id
      WHERE p.student_id = ?
      ORDER BY p.payment_date DESC, p.id DESC`,
    [id]
  );

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const finance = summarizeFinance(student, installments, totalPaid);

  return { ...student, finance, payments };
}

module.exports = { listStudentsWithFinance, listStudentsPage, getStudentDetail };