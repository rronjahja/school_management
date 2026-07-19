const pool = require('../config/db');
const { computeNetQuota, buildInstallments } = require('../utils/finance');
const { httpError } = require('../middleware/errorHandler');

const STUDENT_FIELDS = [
  'first_name', 'last_name', 'birthday', 'city', 'address',
  'phone', 'email', 'citizenship', 'nationality',
  'mother_name', 'mother_last_name', 'mother_birthday',
  'father_name', 'father_last_name',
  'guardian_personal_id', 'guardian_phone', 'guardian_email',
  'category_id', 'contract_number', 'generation', 'class_name', 'enrollment_date',
  'yearly_quota', 'discount_type', 'discount_value', 'payment_plan',
];

/**
 * Nr. i kontrates: NN/VITI/KODI  (p.sh. 06/2026/TD)
 *
 * NN = numri rendor i studentit BRENDA atij drejtimi per ate vit shkollor,
 *      me dy shifra. Nese ka 5 studente ne Teknik Dentar per 2026,
 *      i gjashti merr "06".
 * VITI = viti i fillimit te vitit shkollor (nga gjenerata, p.sh. "2026/2027" -> 2026).
 * KODI = kodi i drejtimit nga tabela `categories` (TD, TF, AF, ...).
 */
async function generateContractNumber(conn, categoryId, generation, enrollmentDate) {
  const [[cat]] = await conn.query('SELECT code FROM categories WHERE id = ?', [categoryId]);
  const code = (cat && cat.code) || '';

  // Viti shkollor: nga gjenerata nese eshte e vlefshme, perndryshe nga data e regjistrimit
  let year = null;
  const m = String(generation || '').match(/\d{4}/);
  if (m) year = Number(m[0]);
  if (!year) {
    const d = new Date(enrollmentDate);
    year = d.getMonth() + 1 >= 8 ? d.getFullYear() : d.getFullYear() - 1;
  }

  const suffix = `/${year}/${code}`;

  // Marrim numrin me te madh ekzistues per kete drejtim+vit (i qendrueshem ndaj fshirjeve)
  const [rows] = await conn.query(
    'SELECT contract_number FROM students WHERE category_id = ? AND contract_number LIKE ?',
    [categoryId, `%${suffix}`]
  );

  let max = 0;
  rows.forEach((r) => {
    const mm = String(r.contract_number || '').match(/^(\d+)\//);
    if (mm) max = Math.max(max, Number(mm[1]));
  });

  return `${String(max + 1).padStart(2, '0')}${suffix}`;
}

function pickStudentFields(body) {
  const data = {};
  STUDENT_FIELDS.forEach((f) => {
    if (body[f] !== undefined) data[f] = body[f] === '' ? null : body[f];
  });
  if (!data.discount_type) data.discount_type = 'none';
  if (data.discount_value === undefined || data.discount_value === null) data.discount_value = 0;
  return data;
}

async function insertInstallments(conn, studentId, student) {
  const net = computeNetQuota(student.yearly_quota, student.discount_type, student.discount_value);
  const installments = buildInstallments(net, student.payment_plan, student.enrollment_date);

  const values = installments.map((i) => [studentId, i.seq, i.due_date, i.amount]);
  await conn.query(
    'INSERT INTO installments (student_id, seq, due_date, amount) VALUES ?',
    [values]
  );
}

/** Krijon studentin dhe gjeneron kestet brenda nje transaksioni. */
async function createStudent(body) {
  const data = pickStudentFields(body);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (!data.contract_number) {
      data.contract_number = await generateContractNumber(
        conn, data.category_id, data.generation, data.enrollment_date
      );
    } else {
      // Numri vjen nga formulari — sigurohemi qe s'eshte zene nderkohe
      const [dup] = await conn.query(
        'SELECT id FROM students WHERE contract_number = ? LIMIT 1',
        [data.contract_number]
      );
      if (dup.length) {
        data.contract_number = await generateContractNumber(
          conn, data.category_id, data.generation, data.enrollment_date
        );
      }
    }

    const [result] = await conn.query('INSERT INTO students SET ?', [data]);
    await insertInstallments(conn, result.insertId, data);

    await conn.commit();
    return result.insertId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Perditeson studentin. Nese ndryshon dicka qe prek kestet
 * (kuota, zbritja, plani, data e regjistrimit), kestet rigjenerohen.
 */
async function updateStudent(id, body) {
  const existing = await getStudentRow(id);
  const data = pickStudentFields(body);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query('UPDATE students SET ? WHERE id = ?', [data, id]);

    // Kestet rigjenerohen gjithmone sipas rregullave aktuale;
    // pagesat ruhen dhe rishperndahen automatikisht (FIFO)
    const merged = { ...existing, ...data };
    await conn.query('DELETE FROM installments WHERE student_id = ?', [id]);
    await insertInstallments(conn, id, merged);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getStudentRow(id) {
  const [rows] = await pool.query(
    `SELECT s.*, c.name AS category_name, c.code AS category_code, c.color AS category_color
       FROM students s
       JOIN categories c ON c.id = s.category_id
      WHERE s.id = ?`,
    [id]
  );
  if (!rows.length) throw httpError(404, 'Studenti nuk u gjet.');
  return rows[0];
}

async function deleteStudent(id) {
  const [result] = await pool.query('DELETE FROM students WHERE id = ?', [id]);
  if (!result.affectedRows) throw httpError(404, 'Studenti nuk u gjet.');
}

/** Lista e studenteve me filtra opsionale (kerkim + drejtim + plan). */
async function listStudents({ search, category_id, payment_plan } = {}) {
  const where = [];
  const params = [];

  if (search) {
    where.push('(s.first_name LIKE ? OR s.last_name LIKE ? OR CONCAT(s.first_name, " ", s.last_name) LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (category_id) {
    where.push('s.category_id = ?');
    params.push(category_id);
  }
  if (payment_plan) {
    where.push('s.payment_plan = ?');
    params.push(payment_plan);
  }

  const [rows] = await pool.query(
    `SELECT s.*, c.name AS category_name, c.code AS category_code, c.color AS category_color,
            COALESCE(p.total_paid, 0) AS total_paid
       FROM students s
       JOIN categories c ON c.id = s.category_id
       LEFT JOIN (
         SELECT student_id, SUM(amount) AS total_paid
           FROM payments GROUP BY student_id
       ) p ON p.student_id = s.id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY s.created_at DESC`,
    params
  );
  return rows;
}

/** Kestet per nje liste studentesh, te grupuara sipas student_id. */
async function installmentsByStudent(studentIds) {
  if (!studentIds.length) return {};
  const [rows] = await pool.query(
    'SELECT * FROM installments WHERE student_id IN (?) ORDER BY seq',
    [studentIds]
  );
  const grouped = {};
  rows.forEach((r) => {
    (grouped[r.student_id] = grouped[r.student_id] || []).push(r);
  });
  return grouped;
}

/** Numri i radhes per nje drejtim+gjenerate (parapamje per formularin). */
async function nextContractNumber(categoryId, generation, enrollmentDate) {
  return generateContractNumber(pool, categoryId, generation, enrollmentDate);
}

module.exports = {
  nextContractNumber,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentRow,
  listStudents,
  installmentsByStudent,
};