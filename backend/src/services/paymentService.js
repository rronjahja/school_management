const pool = require('../config/db');

/** A eshte data e pageses me shume se 1 dite pas dates UTC te serverit? */
function paymentDateTooFar(dateStr, nowMs = Date.now()) {
  const tomorrowUtc = new Date(nowMs + 24 * 3600 * 1000).toISOString().slice(0, 10);
  return String(dateStr).slice(0, 10) > tomorrowUtc;
}
const { httpError } = require('../middleware/errorHandler');
const { isValidDate } = require('../utils/validateStudent');

/** Regjistron nje pagese te re (kesh ose banke). */
async function createPayment({ student_id, amount, payment_date, method, bank_id, note }) {
  if (!student_id) throw httpError(400, 'Nxënësi mungon.');

  // Shuma duhet te jete numer i fundem — "abc" jep NaN dhe duhet refuzuar
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    throw httpError(400, 'Shuma duhet të jetë numër më i madh se 0.');
  }
  const value = Math.round(Number(amount) * 100) / 100;
  if (value > 1000000) throw httpError(400, 'Shuma duket e pasaktë.');

  if (!isValidDate(payment_date)) {
    throw httpError(400, 'Data e pagesës nuk është e vlefshme (formati: VVVV-MM-DD).');
  }
  // Nje pagese nuk mund te regjistrohet per te ardhmen.
  //
  // KUJDES ME OREN: serveri krahason me daten UTC, ndersa perdoruesi shkruan
  // daten e tij lokale. Rreth mesnates (Kosove = UTC+1/+2) data lokale eshte
  // nje dite PERPARA asaj UTC, keshtu qe "sot" i perdoruesit dukej si "neser"
  // dhe refuzohej. Prandaj lejohet deri ne 1 dite perpara dates UTC —
  // mjafton per cdo zone orare, ndersa datat vertet te ardhshme refuzohen.
  if (paymentDateTooFar(payment_date)) {
    throw httpError(400, 'Data e pagesës nuk mund të jetë në të ardhmen.');
  }

  if (!['cash', 'bank'].includes(method)) throw httpError(400, 'Mënyra e pagesës nuk është e vlefshme.');
  if (method === 'bank' && !bank_id) throw httpError(400, 'Zgjidhni bankën.');

  // Kontrollojme ekzistencen para insert-it, qe te japim mesazh te qarte
  // ne vend te nje gabimi te pergjithshem 500 nga kufizimet e bazes.
  const [[student]] = await pool.query('SELECT id FROM students WHERE id = ?', [student_id]);
  if (!student) throw httpError(404, 'Nxënësi nuk u gjet.');

  if (method === 'bank') {
    const [[bank]] = await pool.query('SELECT id FROM banks WHERE id = ?', [bank_id]);
    if (!bank) throw httpError(400, 'Banka e zgjedhur nuk ekziston.');
  }

  const [result] = await pool.query('INSERT INTO payments SET ?', [{
    student_id,
    amount: value,
    payment_date: payment_date.slice(0, 10),
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

module.exports = {
  paymentDateTooFar, createPayment, deletePayment };