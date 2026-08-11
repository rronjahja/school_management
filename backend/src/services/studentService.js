const pool = require('../config/db');
const { computeNetQuota, buildInstallments } = require('../utils/finance');
const { httpError } = require('../middleware/errorHandler');

const STUDENT_FIELDS = [
  'first_name', 'last_name', 'birthday', 'city', 'address',
  'phone', 'email', 'citizenship', 'nationality',
  'mother_name', 'mother_last_name', 'mother_birthday',
  'father_name', 'father_last_name',
  'gender',
  'mother_phone', 'mother_personal_id', 'mother_email',
  'father_phone', 'father_birthday', 'father_personal_id', 'father_email',
  'guardian_name', 'guardian_last_name', 'guardian_phone',
  'guardian_birthday', 'guardian_personal_id', 'guardian_gender', 'guardian_email',
  'primary_contact',
  'category_id', 'contract_number', 'is_transfer',
  'generation', 'class_name', 'study_year', 'enrollment_date',
  'yearly_quota', 'discount_type', 'discount_value', 'payment_plan',
];

/**
 * Nr. i kontrates: NN/VITI/KODI  (p.sh. 06/2026/TD)
 *
 * NN = numri rendor i nxenesit BRENDA atij drejtimi per ate vit shkollor,
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

/** Sa here provohet nje numer kontrate i ri para se te dorezohemi. */
const MAX_CONTRACT_RETRIES = 5;

/** '06/2026/TD' -> '07/2026/TD'. Nese formati s'njihet, kthehet i paprekur. */
function bumpContractNumber(value) {
  const m = String(value || '').match(/^(\d+)(\/.+)$/);
  if (!m) return value;
  return `${String(Number(m[1]) + 1).padStart(2, '0')}${m[2]}`;
}

/**
 * Kush e mban kete numer kontrate? Kthen nxenesin ose null.
 * `exceptId` perjashton vete nxenesin qe po perditesohet.
 */
async function contractHolder(conn, number, exceptId = null) {
  if (!number) return null;
  const [rows] = await conn.query(
    `SELECT id, first_name, last_name FROM students
      WHERE contract_number = ?${exceptId ? ' AND id <> ?' : ''} LIMIT 1`,
    exceptId ? [number, exceptId] : [number]
  );
  return rows[0] || null;
}

/**
 * Gabim i kuptueshem per numrin e zene. Emri i mbajtesit shtohet kur dihet:
 * pa te, perdoruesi s'ka nga t'ia nise per ta zgjidhur konfliktin.
 */
function contractTakenError(number, holder) {
  const who = holder ? ` nga ${holder.first_name} ${holder.last_name}` : '';
  return httpError(409, `Nr. i kontratës ${number} është i zënë${who}.`, 'CONTRACT_TAKEN');
}

/**
 * Normalizon gjeneraten ne formatin e plote "2025/2026".
 * Perdoruesi mund te shkruaje "2025/26" ose "2025" — ruhet gjithmone i njejti format,
 * qe grupimet dhe krahasimet te mos ndahen ne dy variante te te njejtit vit.
 */
function normalizeGeneration(value) {
  // Pranohen vetem 'VVVV/VVVV' ose 'VVVV/VV'; gjithcka tjeter kthehet e paprekur
  // qe validimi ta kape (nuk "riparojme" tekste te gabuara si 'abc2025xyz').
  const m = String(value || '').trim().match(/^(\d{4})\s*\/\s*(?:\d{2}|\d{4})$/);
  if (!m) return value;
  const start = Number(m[1]);
  return `${start}/${start + 1}`;
}

const PHONE_FIELDS = ['phone', 'mother_phone', 'father_phone', 'guardian_phone'];

/**
 * Numri vendor ruhet vetem si shifra; vizat jane ceshtje pamjeje dhe
 * i vendos nderfaqja. Nje numer i huaj ruhet ashtu si eshte shkruar,
 * sepse s'ka forme te vetme per t'u dhene.
 *
 * Kjo pastron edhe te dhenat e vjetra, ku numri mund te jete ruajtur
 * si «044-123-456»: pa kete, i njejti numer do te ekzistonte ne dy
 * forma dhe kerkimi do te gjente vetem njeren.
 */
function normalizePhone(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  const local = /^0\d{8}$/.test(digits) && !/[^\d\s-]/.test(raw);
  return local ? digits : raw;
}

function pickStudentFields(body) {
  const data = {};
  STUDENT_FIELDS.forEach((f) => {
    if (body[f] !== undefined) data[f] = body[f] === '' ? null : body[f];
  });

  // Kolona is_transfer eshte NOT NULL: nje kutize e pashenuar mund te vije
  // si false, '0', null a undefined — te gjitha kthehen ne 0/1.
  if (data.is_transfer !== undefined) {
    data.is_transfer = (data.is_transfer === true || data.is_transfer === 1
      || data.is_transfer === '1' || data.is_transfer === 'true') ? 1 : 0;
  }
  PHONE_FIELDS.forEach((f) => {
    if (data[f] !== undefined && data[f] !== null) data[f] = normalizePhone(data[f]);
  });
  if (data.generation) data.generation = normalizeGeneration(data.generation);
  if (!data.discount_type) data.discount_type = 'none';
  if (data.discount_value === undefined || data.discount_value === null) data.discount_value = 0;
  return data;
}

async function insertInstallments(conn, studentId, student, seqOffset = 0) {
  const net = computeNetQuota(student.yearly_quota, student.discount_type, student.discount_value);
  const generation = normalizeGeneration(student.generation);
  const installments = buildInstallments(net, student.payment_plan, student.enrollment_date, generation);

  const values = installments.map((i) => [
    studentId, generation, seqOffset + i.seq, i.due_date, i.amount,
  ]);
  await conn.query(
    'INSERT INTO installments (student_id, generation, seq, due_date, amount) VALUES ?',
    [values]
  );
}

/** Krijon studentin dhe gjeneron kestet brenda nje transaksioni. */
/**
 * Kuota vjetore percaktohet nga DREJTIMI, jo nga formulari.
 * Kjo e ben serverin burimin e vertete: edhe nese dikush dergon nje vlere
 * tjeter direkt ne API, perdoret ajo e konfiguruar te Cilesimet.
 * Nese drejtimi nuk ka kuote te caktuar, pranohet vlera e derguar.
 */
async function quotaForCategory(categoryId, fallback) {
  const [[cat]] = await pool.query(
    'SELECT default_quota FROM categories WHERE id = ?', [categoryId]
  );
  if (cat && cat.default_quota !== null && cat.default_quota !== undefined) {
    return Number(cat.default_quota);
  }
  return fallback;
}

async function createStudent(body, opts = {}) {
  const data = pickStudentFields(body);

  // Kuota merret nga konfigurimi i drejtimit — pervec migrimit te kontratave,
  // ku cmimi i kontrates se nenshkruar (edhe i nje viti te vjeter) ka perparesi.
  const keepContractQuota = opts.allowQuotaOverride === true && body.quota_override === true;
  if (!keepContractQuota) {
    data.yearly_quota = await quotaForCategory(data.category_id, data.yearly_quota);
  }

  // A e shkroi numrin vete perdoruesi? Kjo vendos si trajtohet nje perplasje:
  // numri i shkruar me dore NUK nderrohet ne heshtje, sepse kontrata ne leter
  // mban pikerisht ate numer. Numri i gjeneruar vete mund te rritet lirshem.
  const userSuppliedNumber = Boolean(data.contract_number);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (!data.contract_number) {
      data.contract_number = await generateContractNumber(
        conn, data.category_id, data.generation, data.enrollment_date
      );
    } else {
      const holder = await contractHolder(conn, data.contract_number);
      if (holder) throw contractTakenError(data.contract_number, holder);
    }

    // Numri i kontrates gjenerohet me «lexo maksimumin, shto nje». Dy
    // regjistrime njekohesisht e lexojne te njejtin maksimum dhe prodhojne
    // te njejtin numer; kufizimi UNIQUE i bazes e ndalon te dytin. Ne vend
    // qe perdoruesi te shohe nje gabim te pashpjegueshem, numri rritet me
    // nje dhe provohet serish.
    //
    // Rritja behet KETU e jo me nje pyetje te re: brenda transaksionit,
    // nje SELECT i dyte sheh te njejtin fotografim te bazes dhe do te
    // kthente perseri te njejtin maksimum.
    let result = null;
    for (let attempt = 0; attempt < MAX_CONTRACT_RETRIES && !result; attempt += 1) {
      try {
        [result] = await conn.query('INSERT INTO students SET ?', [data]);
      } catch (err) {
        const duplicateContract = err.code === 'ER_DUP_ENTRY'
          && String(err.message || '').includes('contract_number');
        if (!duplicateContract) throw err;

        // Numri i shkruar nga perdoruesi raportohet, nuk rritet: perndryshe
        // nxenesi do te ruhej me nje numer tjeter nga ai i kontrates se tij.
        if (userSuppliedNumber) {
          throw contractTakenError(
            data.contract_number,
            await contractHolder(conn, data.contract_number)
          );
        }
        if (attempt === MAX_CONTRACT_RETRIES - 1) throw err;
        data.contract_number = bumpContractNumber(data.contract_number);
      }
    }

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
/**
 * Perditeson studentin.
 *
 * KUJDES: kestet e VITEVE TE KALUARA nuk preken kurre. Rigjenerohen vetem
 * kestet e vitit shkollor aktual, dhe vetem nese ndryshon dicka financiare
 * (kuota, zbritja, plani ose data e regjistrimit). Nje ndryshim i thjeshte
 * i telefonit apo adreses nuk prek asnje kest.
 */
const FINANCE_KEYS = [
  'yearly_quota', 'discount_type', 'discount_value', 'payment_plan', 'enrollment_date',
];

/**
 * A jane e njejta vlere? DECIMAL kthehet si tekst nga mysql2 ('0.00'),
 * ndersa formulari dergon numer (0). Krahasimi si tekst do te dilte
 * GJITHMONE i ndryshem dhe kestet do te rigjeneroheshin ne cdo ruajtje —
 * edhe kur ndryshon vetem telefoni.
 */
function sameFieldValue(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (a !== '' && b !== '' && Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  return String(a) === String(b);
}

async function updateStudent(id, body) {
  const existing = await getStudentRow(id);
  const data = pickStudentFields(body);

  // Nese ndryshon drejtimi, kuota merret nga konfigurimi i drejtimit te ri.
  // Nese drejtimi mbetet i njejti, kuota e studentit NUK preket — kontrata
  // e nenshkruar nuk ndryshon kur dikush perditeson kuotat te Cilesimet.
  if (data.category_id !== undefined &&
    Number(data.category_id) !== Number(existing.category_id)) {
    data.yearly_quota = await quotaForCategory(data.category_id, data.yearly_quota);
  } else {
    data.yearly_quota = existing.yearly_quota;
  }

  // KUJDES: `merged` ndertohet PAS zgjidhjes se kuotes. Po ta merrnim me
  // heret, kestet do te ndertoheshin mbi kuoten e derguar nga formulari,
  // kurse baza do te ruante nje tjeter — dhe `yearly_quota` nuk do t'i
  // binte me ndesh shumes se kesteve.
  const merged = { ...existing, ...data };

  const financeChanged = FINANCE_KEYS.some(
    (k) => data[k] !== undefined && !sameFieldValue(data[k], existing[k])
  );
  // Ndryshimi i gjenerates trajtohet nga kalimi i vitit, jo nga ky formular
  const generationChanged =
    data.generation !== undefined &&
    normalizeGeneration(data.generation) !== normalizeGeneration(existing.generation);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Numri i kontrates nuk kontrollohej fare gjate ndryshimit: mjaftonte te
    // shkruhej nje numer i zene per te krijuar nje dublikat. Tani konflikti
    // raportohet me emrin e mbajtesit, para se ta ndaloje baza me nje gabim
    // qe s'do t'i thoshte perdoruesit se ku eshte problemi.
    if (data.contract_number !== undefined &&
      String(data.contract_number || '') !== String(existing.contract_number || '')) {
      const holder = await contractHolder(conn, data.contract_number, id);
      if (holder) throw contractTakenError(data.contract_number, holder);
    }

    await conn.query('UPDATE students SET ? WHERE id = ?', [data, id]);

    if (financeChanged || generationChanged) {
      const currentGen = normalizeGeneration(merged.generation);
      const previousGen = normalizeGeneration(existing.generation);

      // Fshihen kestet e vitit aktual. Kur ndryshon gjenerata, fshihen edhe
      // ato te vitit te MEPARSHEM: pa kete, `currentGen` do te ishte viti i
      // RI (ku ende s'ka asnje kest), kestet e vjetra do te mbeteshin, dhe
      // MAX(seq) me poshte do t'i shtynte te rejat pas tyre — nxenesi do te
      // perfundonte me dy vite kestesh dhe borxh te dyfishuar.
      //
      // `is_carryover = 0` mbron rreshtin «Borxhi i vitit te kaluar»: ai i
      // takon nje viti tjeter dhe nuk rillogaritet kurre ketu.
      await conn.query(
        `DELETE FROM installments
          WHERE student_id = ? AND is_carryover = 0 AND generation IN (?, ?)`,
        [id, currentGen, previousGen]
      );

      // Kestet pa vit shkollor (te dhena para migrimit 005/007) hiqen
      // GJITHMONE, jo vetem kur ndryshon gjenerata: po t'i linim, MAX(seq)
      // me poshte do t'i shtynte kestet e reja pas tyre dhe borxhi i
      // nxenesit do te dyfishohej ne heshtje.
      await conn.query(
        'DELETE FROM installments WHERE student_id = ? AND generation IS NULL',
        [id]
      );

      // Numrat e kesteve vazhdojne pas atyre qe mbeten
      const [[mx]] = await conn.query(
        'SELECT COALESCE(MAX(seq), 0) AS m FROM installments WHERE student_id = ?',
        [id]
      );
      await insertInstallments(conn, id, merged, Number(mx.m));
    }

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
  if (!rows.length) throw httpError(404, 'Nxënësi nuk u gjet.');
  return rows[0];
}

async function deleteStudent(id) {
  const [result] = await pool.query('DELETE FROM students WHERE id = ?', [id]);
  if (!result.affectedRows) throw httpError(404, 'Nxënësi nuk u gjet.');
}

/** Lista e studenteve me filtra opsionale (kerkim + drejtim + plan). */
/**
 * Kushtet e filtrimit, te ndara qe lista dhe numerimi te perdorin
 * SAKTESISHT te njejtat: perndryshe numri i pergjithshem do t'i takonte
 * nje filtri, kurse rreshtat nje tjetri, dhe faqja e fundit do te dilte
 * bosh pa asnje shpjegim.
 */
function studentFilter({ search, category_id, payment_plan, study_year, status } = {}) {
  const where = [];
  const params = [];

  if (search) {
    where.push('(s.first_name LIKE ? OR s.last_name LIKE ? OR CONCAT(s.first_name, " ", s.last_name) LIKE ?)');
    // '%' dhe '_' te shkruara nga perdoruesi jane shkronja, jo xhoker:
    // pa kete, kerkimi per «%» do te ktheu te gjithe nxenesit.
    const like = `%${String(search).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
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
  if (study_year) {
    where.push('s.study_year = ?');
    params.push(study_year);
  }
  // Si parazgjedhje shfaqen vetem studentet aktive
  if (status !== 'all') {
    where.push('s.status = ?');
    params.push(status || 'active');
  }

  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

/** Sa nxenes i pergjigjen ketij filtri — per faqosjen. */
async function countStudents(filters = {}) {
  const { clause, params } = studentFilter(filters);
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS n FROM students s ${clause}`,
    params
  );
  return Number(row.n);
}

/**
 * Lista e nxenesve. Pa `limit` kthen gjithcka, si me pare — dashboard-i
 * dhe raportet i duan te gjithe. Me `limit` kthen vetem nje faqe.
 */
async function listStudents(filters = {}) {
  const { clause, params } = studentFilter(filters);

  const limit = Number(filters.limit);
  const paged = Number.isInteger(limit) && limit > 0;
  const offset = Math.max(Number(filters.offset) || 0, 0);

  const [rows] = await pool.query(
    `SELECT s.*, c.name AS category_name, c.code AS category_code, c.color AS category_color,
            COALESCE(p.total_paid, 0) AS total_paid
       FROM students s
       JOIN categories c ON c.id = s.category_id
       LEFT JOIN (
         SELECT student_id, SUM(amount) AS total_paid
           FROM payments GROUP BY student_id
       ) p ON p.student_id = s.id
      ${clause}
      ORDER BY s.created_at DESC, s.id DESC
      ${paged ? 'LIMIT ? OFFSET ?' : ''}`,
    paged ? [...params, limit, offset] : params
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
  normalizeGeneration,
  nextContractNumber,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentRow,
  listStudents,
  countStudents,
  installmentsByStudent,
  bumpContractNumber,
};