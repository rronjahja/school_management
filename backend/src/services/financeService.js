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

module.exports = { listStudentsWithFinance, getStudentDetail };
