const pool = require('../config/db');
const { computeNetQuota, buildInstallments, round2 } = require('../utils/finance');
const { httpError } = require('../middleware/errorHandler');
const { isValidDate } = require('../utils/validateStudent');

const FINAL_YEAR = 3; // viti i fundit i shkollimit
/** '2024/2025' -> '2025/2026' */
function nextGeneration(generation) {
  const m = String(generation || '').match(/(\d{4})\s*\/\s*(\d{2,4})/);
  if (!m) return null;
  const start = Number(m[1]) + 1;
  return `${start}/${start + 1}`;
}

/** Viti shkollor aktual sipas dates (gusht = fillimi i vitit te ri). */
function currentGeneration(today = new Date()) {
  const start = today.getMonth() + 1 >= 8 ? today.getFullYear() : today.getFullYear() - 1;
  return `${start}/${start + 1}`;
}

/** Gjeneratat aktive me numrin e studenteve per secilin vit studimi. */
async function listGenerations() {
  const [rows] = await pool.query(
    `SELECT generation,
            SUM(study_year = 1) AS viti1,
            SUM(study_year = 2) AS viti2,
            SUM(study_year = 3) AS viti3,
            COUNT(*) AS total
       FROM students
      WHERE status = 'active'
      GROUP BY generation
      ORDER BY generation`
  );
  return rows.map((r) => ({
    generation: r.generation,
    viti1: Number(r.viti1),
    viti2: Number(r.viti2),
    viti3: Number(r.viti3),
    total: Number(r.total),
    next: nextGeneration(r.generation),
  }));
}

/** Historiku i promovimeve te kryera. */
async function listPromotions() {
  const [rows] = await pool.query('SELECT * FROM promotions ORDER BY run_at DESC');
  return rows;
}

/**
 * Parapamje: cfare do te ndodhe nese promovohet nje gjenerate.
 * Nuk ndryshon asgje ne baze.
 */
async function preview(fromGeneration) {
  const to = nextGeneration(fromGeneration);
  if (!to) throw httpError(400, 'Gjenerata nuk është e vlefshme (p.sh. 2024/2025).');

  const [[done]] = await pool.query(
    'SELECT COUNT(*) AS c FROM promotions WHERE from_generation = ?',
    [fromGeneration]
  );

  const [rows] = await pool.query(
    `SELECT s.study_year, COUNT(*) AS n,
            SUM(GREATEST(COALESCE(i.total,0) - COALESCE(p.total,0), 0)) AS debt
       FROM students s
       LEFT JOIN (SELECT student_id, SUM(amount) total FROM installments GROUP BY student_id) i
              ON i.student_id = s.id
       LEFT JOIN (SELECT student_id, SUM(amount) total FROM payments GROUP BY student_id) p
              ON p.student_id = s.id
      WHERE s.status = 'active' AND s.generation = ?
      GROUP BY s.study_year
      ORDER BY s.study_year`,
    [fromGeneration]
  );

  // Sa nxenes e humbin zbritjen kur kalojne vitin — kjo duhet thene PARA
  // se te shtypet butoni, jo te zbulohet me pas nga nje prind i habitur.
  const [[disc]] = await pool.query(
    `SELECT COUNT(*) AS n
       FROM students
      WHERE status = 'active' AND generation = ? AND study_year < ?
        AND discount_type <> 'none' AND discount_value > 0`,
    [fromGeneration, FINAL_YEAR]
  );

  const byYear = rows.map((r) => ({
    study_year: r.study_year,
    students: Number(r.n),
    debt: round2(Number(r.debt) || 0),
    action: r.study_year >= FINAL_YEAR ? 'graduate' : 'promote',
  }));

  return {
    from_generation: fromGeneration,
    to_generation: to,
    already_done: done.c > 0,
    losing_discount: Number(disc.n),
    promote: byYear.filter((y) => y.action === 'promote'),
    graduate: byYear.filter((y) => y.action === 'graduate'),
    promote_total: byYear.filter((y) => y.action === 'promote').reduce((a, y) => a + y.students, 0),
    graduate_total: byYear.filter((y) => y.action === 'graduate').reduce((a, y) => a + y.students, 0),
    graduate_debt: round2(
      byYear.filter((y) => y.action === 'graduate').reduce((a, y) => a + y.debt, 0)
    ),
  };
}

/** Nr. i ri i kontrates per vitin e ri. */
async function newContractNumber(conn, categoryId, generation) {
  const [[cat]] = await conn.query('SELECT code FROM categories WHERE id = ?', [categoryId]);
  const code = (cat && cat.code) || '';
  const year = Number(String(generation).slice(0, 4));
  const suffix = `/${year}/${code}`;

  const [rows] = await conn.query(
    'SELECT contract_number FROM students WHERE category_id = ? AND contract_number LIKE ?',
    [categoryId, `%${suffix}`]
  );
  let max = 0;
  rows.forEach((r) => {
    const m = String(r.contract_number || '').match(/^(\d+)\//);
    if (m) max = Math.max(max, Number(m[1]));
  });
  return `${String(max + 1).padStart(2, '0')}${suffix}`;
}

/**
 * Kryen promovimin:
 *  - Viti 1 -> 2, Viti 2 -> 3 (gjenerata kalon ne vitin pasues)
 *  - Viti 3 -> i diplomuar (borxhi mbetet i paprekur)
 * Kestet dhe pagesat ekzistuese NUK fshihen kurre.
 */
async function promote({
  from_generation,
  create_new_year = true,
  quota_increase = 0,
  year_start_date,
  force = false,
}) {
  const to = nextGeneration(from_generation);
  if (!to) throw httpError(400, 'Gjenerata nuk është e vlefshme (p.sh. 2024/2025).');

  const [[done]] = await pool.query(
    'SELECT COUNT(*) AS c FROM promotions WHERE from_generation = ?',
    [from_generation]
  );
  if (done.c > 0 && !force) {
    throw httpError(409, `Gjenerata ${from_generation} është promovuar tashmë.`);
  }

  const startDate = year_start_date || `${String(to).slice(0, 4)}-09-01`;
  if (!isValidDate(startDate)) {
    throw httpError(400, 'Data e fillimit të vitit nuk është e vlefshme.');
  }

  const increase = Number(quota_increase) || 0;
  if (!Number.isFinite(increase) || increase < 0 || increase > 100) {
    throw httpError(400, 'Rritja e kuotës duhet të jetë midis 0% dhe 100%.');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [students] = await conn.query(
      `SELECT * FROM students
        WHERE status = 'active' AND generation = ?
        ORDER BY category_id, id`,
      [from_generation]
    );

    // Kuotat standarde te drejtimeve — baza e vitit te ri.
    //
    // Politika e kolegjit: nje zbritje vlen VETEM per vitin ne te cilin u
    // dha. Vitin tjeter nxenesi kthehet te cmimi standard i drejtimit, dhe
    // nese i takon sërish zbritje, ajo jepet me dore nga stafi. Prandaj
    // ketu nuk bartet as kuota e vjeter e nxenesit (qe mund te ishte
    // ndryshuar me dore), as zbritja e vitit qe po mbyllet.
    const [cats] = await conn.query('SELECT id, default_quota FROM categories');
    const standardQuota = new Map(
      cats.filter((c) => c.default_quota !== null)
        .map((c) => [c.id, Number(c.default_quota)])
    );

    let promoted = 0;
    let graduated = 0;

    for (const s of students) {
      // 1. Arkivojme vitin qe po mbyllet
      await conn.query(
        `INSERT IGNORE INTO student_year_history
           (student_id, generation, study_year, contract_number, yearly_quota,
            discount_type, discount_value, payment_plan, enrollment_date)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [s.id, s.generation, s.study_year, s.contract_number, s.yearly_quota,
        s.discount_type, s.discount_value, s.payment_plan, s.enrollment_date]
      );

      if (s.study_year >= FINAL_YEAR) {
        // 2a. Diplomohet — borxhi mbetet ashtu si eshte
        await conn.query(
          `UPDATE students
              SET status = 'graduated', graduated_at = CURDATE(), graduation_generation = ?
            WHERE id = ?`,
          [s.generation, s.id]
        );
        graduated += 1;
        continue;
      }

      // 2b. Kalon ne vitin pasues
      const contract = await newContractNumber(conn, s.category_id, to);

      // Baza eshte kuota standarde e drejtimit. Nese drejtimi s'ka kuote te
      // vendosur, mbetet ajo e nxenesit — me mire nje shume e bartur se nje
      // zero e heshtur qe do te dukej si shkollim falas.
      const base = standardQuota.has(s.category_id)
        ? standardQuota.get(s.category_id)
        : Number(s.yearly_quota);
      const newQuota = round2(base * (1 + increase / 100));

      await conn.query(
        `UPDATE students
            SET study_year = study_year + 1,
                generation = ?,
                contract_number = ?,
                enrollment_date = ?,
                yearly_quota = ?,
                discount_type = 'none',
                discount_value = 0
          WHERE id = ?`,
        [to, contract, startDate, create_new_year ? newQuota : base, s.id]
      );

      // 2c. Mbyllja e vitit te vjeter: kestet e paguara HIQEN; borxhi i mbetur
      //     (nese ka) behet NJE rresht i vetem "Borxhi i vitit te kaluar" ne krye.
      //
      //     Llogaria mbetet e sakte sepse pjesa e pagesave qe mbuloi kestet e
      //     hequra regjistrohet te students.settled_paid dhe nuk shperndahet me.
      const [oldInsts] = await conn.query(
        'SELECT amount FROM installments WHERE student_id = ?',
        [s.id]
      );
      const [[pay]] = await conn.query(
        'SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE student_id = ?',
        [s.id]
      );

      const oldDue = round2(oldInsts.reduce((a, i) => a + Number(i.amount), 0));
      const effectivePaid = round2(
        Math.max(Number(pay.total) - Number(s.settled_paid || 0), 0)
      );
      const consumed = round2(Math.min(effectivePaid, oldDue));
      const remainder = round2(oldDue - consumed);

      await conn.query('DELETE FROM installments WHERE student_id = ?', [s.id]);
      await conn.query(
        'UPDATE students SET settled_paid = round(settled_paid + ?, 2) WHERE id = ?',
        [consumed, s.id]
      );

      // Borxhi i bartur merr seq 0: renditet i pari dhe paguhet i pari (FIFO),
      // ndersa kestet e vitit te ri numerohen normalisht 1..n kudo
      // (tabele, kontrate, rikujtese).
      if (remainder > 0.005) {
        await conn.query('INSERT INTO installments SET ?', [{
          student_id: s.id,
          generation: s.generation, // viti nga i cili vjen borxhi
          is_carryover: 1,
          seq: 0,
          due_date: startDate,
          amount: remainder,
        }]);
      }

      if (create_new_year) {
        const net = computeNetQuota(newQuota, s.discount_type, s.discount_value);
        const fresh = buildInstallments(net, s.payment_plan, startDate, to);

        const values = fresh.map((i) => [s.id, to, i.seq, i.due_date, i.amount]);
        await conn.query(
          'INSERT INTO installments (student_id, generation, seq, due_date, amount) VALUES ?',
          [values]
        );
      }
      promoted += 1;
    }

    await conn.query(
      `INSERT INTO promotions
         (from_generation, to_generation, promoted_count, graduated_count,
          new_year_created, quota_increase)
       VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         promoted_count = promoted_count + VALUES(promoted_count),
         graduated_count = graduated_count + VALUES(graduated_count),
         run_at = CURRENT_TIMESTAMP`,
      [from_generation, to, promoted, graduated, create_new_year ? 1 : 0, increase]
    );

    await conn.commit();
    return { from_generation, to_generation: to, promoted, graduated };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  nextGeneration,
  currentGeneration,
  listGenerations,
  listPromotions,
  preview,
  promote,
};