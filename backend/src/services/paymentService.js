const pool = require('../config/db');
const { httpError } = require('../middleware/errorHandler');

/** Regjistron nje pagese te re (kesh ose banke). */
async function createPayment({ student_id, amount, payment_date, method, bank_id, note }) {
  if (!student_id) throw httpError(400, 'Studenti mungon.');
  if (!amount || Number(amount) <= 0) throw httpError(400, 'Shuma duhet të jetë më e madhe se 0.');
  if (!payment_date) throw httpError(400, 'Data e pagesës është e detyrueshme.');
  if (!['cash', 'bank'].includes(method)) throw httpError(400, 'Mënyra e pagesës nuk është e vlefshme.');
  if (method === 'bank' && !bank_id) throw httpError(400, 'Zgjidhni bankën.');

  // Kontrollojme ekzistencen para insert-it, qe te japim mesazh te qarte
  // ne vend te nje gabimi te pergjithshem 500 nga kufizimet e bazes.
  const [[student]] = await pool.query('SELECT id FROM students WHERE id = ?', [student_id]);
  if (!student) throw httpError(404, 'Studenti nuk u gjet.');

  if (method === 'bank') {
    const [[bank]] = await pool.query('SELECT id FROM banks WHERE id = ?', [bank_id]);
    if (!bank) throw httpError(400, 'Banka e zgjedhur nuk ekziston.');
  }

  const [result] = await pool.query('INSERT INTO payments SET ?', [{
    student_id,
    amount: Number(amount),
    payment_date,
    method,
    bank_id: method === 'bank' ? bank_id : null,
    note: note || null,
  }]);
  return result.insertId;
}

/** Fshin nje pagese (ne rast gabimi gjate regjistrimit). */
async function deletePayment(id) {
  const [result] = await pool.query('DELETE FROM payments WHERE id = ?', [id]);
  if (!result.affectedRows) throw httpError(404, 'Pagesa nuk u gjet.');
}

module.exports = { createPayment, deletePayment };