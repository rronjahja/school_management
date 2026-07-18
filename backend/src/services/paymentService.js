const pool = require('../config/db');
const { httpError } = require('../middleware/errorHandler');

/** Regjistron nje pagese te re (kesh ose banke). */
async function createPayment({ student_id, amount, payment_date, method, bank_id, note }) {
  if (!student_id) throw httpError(400, 'Studenti mungon.');
  if (!amount || Number(amount) <= 0) throw httpError(400, 'Shuma duhet të jetë më e madhe se 0.');
  if (!payment_date) throw httpError(400, 'Data e pagesës është e detyrueshme.');
  if (!['cash', 'bank'].includes(method)) throw httpError(400, 'Mënyra e pagesës nuk është e vlefshme.');
  if (method === 'bank' && !bank_id) throw httpError(400, 'Zgjidhni bankën.');

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
