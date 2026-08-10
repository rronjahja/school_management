const pool = require('../config/db');
const { httpError } = require('../middleware/errorHandler');
const { isManager, isReviewer } = require('../config/roles');

/**
 * Ditari i klasës — digjitalizimi i librit fizik
 * «Suksesi i nxënësve sipas lëndëve mësimore».
 *
 * RREGULLI KRYESOR I SIGURISË: kujdestari sheh dhe ndryshon VETËM
 * paralelen ku është caktuar nga administratori. Çdo funksion këtu
 * kalon nga assertClassAccess — kontrolli bëhet në server, jo në
 * ndërfaqe. Administratori ka qasje kudo.
 *
 * Lista e nxënësve të një paraleleje NUK ruhet si tabelë më vete:
 * nxirret nga students sipas (drejtimi, viti i studimit, gjenerata).
 * Kështu një nxënës i saporegjistruar shfaqet vetvetiu në ditar dhe
 * askush s'harron ta «shtojë në klasë».
 */

// Sa nota të vazhdueshme mund të mbajë një qelizë (si në librin fizik)
const MAX_GRADES_PER_CELL = 12;

/**
 * Kush mund te caktohet kujdestar i nje paraleleje.
 *
 * Perfshihet edhe stafi: ne shkolle nje arsimtar shpesh mban edhe
 * kujdestarine e nje paraleleje, pa qene roli i tij vetem ky. Roli
 * 'kujdestar' mbetet per ata qe MERREN vetem me ditarin.
 */
const KUJDESTAR_ROLES = ['kujdestar', 'staff'];

/** Sa paralele mund te kete nje drejtim ne nje vit. */
const MAX_PARALLELS = 8;

/** Prefiksi roman sipas vitit te studimit — si te nxenesit. */
const YEAR_ROMAN = { 1: 'X', 2: 'XI', 3: 'XII' };

/**
 * Paralelja per shfaqje: viti (roman) + numri i ruajtur, p.sh. 'XII/1'.
 * Ne baze ruhet vetem numri, sepse viti ndodhet te study_year — keshtu
 * te dyja nuk mund te bien ne kundershtim.
 */
const classLabelOf = (studyYear, name) => {
  const roman = YEAR_ROMAN[studyYear];
  return roman ? `${roman}/${name}` : String(name);
};

/** I shton cdo rreshti paralele etiketen e gatshme per ekran. */
const withLabel = (row) =>
  (row ? { ...row, label: classLabelOf(row.study_year, row.name) } : row);

const TERM_LABELS = { gj1: 'Gjysmëvjetori I', gj2: 'Gjysmëvjetori II' };

/**
 * Mbyllja e notës. Përveç notës përfundimtare të rreshtit N.P., çdo
 * gjysmëvjetor mbyllet më vete — shifra e madhe pranë notave të vogla
 * të vazhdueshme, brenda rreshtave I dhe II të librit.
 */
const FINAL_TERMS = ['gj1', 'gj2', 'final'];

const FINAL_TERM_LABELS = {
  gj1: 'Mbyllja e Gjysmëvjetorit I',
  gj2: 'Mbyllja e Gjysmëvjetorit II',
  final: 'Nota përfundimtare',
};

/** Grupet e kolonave, në renditjen e librit fizik. */
const GROUPS = ['gjuhet', 'matematika', 'shkencat', 'shoqeria', 'sportet',
  'teknologjia', 'teorike', 'praktike'];

const GROUP_LABELS = {
  gjuhet: 'Gjuhët dhe komunikimi',
  matematika: 'Matematikë',
  shkencat: 'Shkencat natyrore',
  shoqeria: 'Shoqëria dhe mjedisi',
  sportet: 'Ed. fizike, sportet dhe shëndeti',
  teknologjia: 'Teknologjia',
  teorike: 'Lëndët profesionale — teorike',
  praktike: 'Praktika profesionale',
};

/**
 * Lëndët e bërthamës që merr çdo paralele e re — si faqja e shtypur e
 * librit. Lëndët profesionale (teorike/praktike) ndryshojnë sipas
 * drejtimit dhe i shton vetë kujdestari, siç i shkruan me dorë në libër.
 */
const DEFAULT_SUBJECTS = [
  ['Gjuhë shqipe', 'gjuhet'],
  ['Gjuhë angleze', 'gjuhet'],
  ['Gjuhë gjermane', 'gjuhet'],
  ['Matematikë', 'matematika'],
  ['Biologji', 'shkencat'],
  ['Fizikë', 'shkencat'],
  ['Kimi', 'shkencat'],
  ['Gjeografi', 'shkencat'],
  ['Histori', 'shoqeria'],
  ['Edukatë qytetare', 'shoqeria'],
  ['Psikologji', 'shoqeria'],
  ['Ed. fizike, sportet dhe shëndeti', 'sportet'],
  ['Teknologji me TIK', 'teknologjia'],
  ['Ndërmarrësi', 'teknologjia'],
];

// ---------------------------------------------------------------
//  Vërtetime të vogla
// ---------------------------------------------------------------

function assertGradeValue(value) {
  const v = Number(value);
  if (!Number.isInteger(v) || v < 1 || v > 5) {
    throw httpError(400, 'Nota duhet të jetë numër i plotë nga 1 deri në 5.');
  }
  return v;
}

function assertTerm(term) {
  if (!['gj1', 'gj2'].includes(term)) {
    throw httpError(400, 'Gjysmëvjetori duhet të jetë "gj1" ose "gj2".');
  }
  return term;
}

/** Mbyllja i takon njërit gjysmëvjetor ose është nota përfundimtare. */
function assertFinalTerm(term) {
  const t = term || 'final';
  if (!FINAL_TERMS.includes(t)) {
    throw httpError(400, 'Mbyllja duhet të jetë "gj1", "gj2" ose "final".');
  }
  return t;
}

function assertAbsences(value, label) {
  const v = Number(value);
  if (!Number.isInteger(v) || v < 0 || v > 999) {
    throw httpError(400, `Mungesat (${label}) duhet të jenë numër nga 0 deri në 999.`);
  }
  return v;
}

/** Nota e sjelljes lejohet edhe bosh (null = ende pa u vendosur). */
function assertConduct(value, label) {
  if (value === null || value === undefined || value === '') return null;
  const v = Number(value);
  if (!Number.isInteger(v) || v < 1 || v > 5) {
    throw httpError(400, `Nota e sjelljes (${label}) duhet të jetë nga 1 deri në 5.`);
  }
  return v;
}

// ---------------------------------------------------------------
//  Qasja në paralele — thelbi i sigurisë së kujdestarit
// ---------------------------------------------------------------

/**
 * Kthen paralelen nëse përdoruesi mund ta HAPË, përndryshe 403.
 *
 * Leximi është më i gjerë se shkrimi: kontrolluesit (stafi) duhet ta
 * hapin ditarin e çdo paraleleje për ta krahasuar me librin fizik, por
 * pa e prekur. Shkrimin e ruan assertClassWrite.
 */
async function assertClassAccess(user, classId) {
  const [[cls]] = await pool.query(
    `SELECT c.*, cat.name AS category_name, cat.color AS category_color,
            u.full_name AS kujdestar_name
       FROM classes c
       JOIN categories cat ON cat.id = c.category_id
  LEFT JOIN users u ON u.id = c.kujdestar_id
      WHERE c.id = ?`,
    [classId]
  );
  if (!cls) throw httpError(404, 'Paralelja nuk u gjet.');

  // Pronesia varet nga CAKTIMI, jo nga emri i rolit: kujdestar i nje
  // paraleleje mund te jete edhe nje anetar i stafit.
  const isOwner = cls.kujdestar_id === user.id;
  if (!isManager(user) && !isReviewer(user) && !isOwner) {
    throw httpError(403, 'Nuk keni qasje në ditarin e kësaj paraleleje.');
  }
  return cls;
}

/**
 * Si me siper, por per veprimet qe NDRYSHOJNE ditarin.
 *
 * Shkruajne: kujdestari i caktuar i paraleles, stafi qe kontrollon,
 * menaxheri dhe administratori. Nje note e mbyllur nuk eshte e kycur —
 * kujdestari e ndryshon kurdo, dhe stafi e korrigjon vete kur gjen nje
 * mospertputhje me librin fizik.
 */
async function assertClassWrite(user, classId) {
  const cls = await assertClassAccess(user, classId);
  if (!canWriteClass(user, cls)) {
    throw httpError(403, 'Nuk keni të drejtë të plotësoni ditarin e kësaj paraleleje.');
  }
  return cls;
}

/** A mund ta shkruaje ky perdorues kete paralele? (pa hedhur gabim) */
const canWriteClass = (user, cls) =>
  isManager(user) || isReviewer(user) || cls.kujdestar_id === user.id;

/**
 * Nxënësit e paraleles: aktivë, të të njëjtit drejtim, vit studimi dhe
 * gjeneratë. Nëse nxënësi ka `class_name` të plotësuar dhe ai ndryshon
 * nga emri i paraleles, përjashtohet — kështu dy paralele të të njëjtit
 * drejtim/vit nuk përzihen.
 *
 * Rendi: ai i vendosur nga kujdestari (class_student_meta.position) dhe,
 * për këdo pa rend ende — p.sh. një nxënës i saporegjistruar — alfabeti,
 * në fund të listës. Kështu rendi i ditarit nuk prishet kurrë vetvetiu.
 *
 * «Emri i prindit» në ditar është GJITHNJË emri i babait, si në librin
 * fizik: aty ai shërben si atësi e nxënësit — «Rea (Flamur) Kaçiku» —
 * jo si e dhënë kontakti. Kontakti i parë (primary_contact) mund të jetë
 * nëna ose kujdestari dhe ndryshon sipas nevojës; atësia nuk ndryshon.
 * Po t'i lidhnim të dyja, i njëjti nxënës do të dukej me emra të
 * ndryshëm prindi varësisht se kë kishin vënë si kontakt.
 */
async function rosterOf(cls) {
  const [rows] = await pool.query(
    `SELECT s.id, s.first_name, s.last_name, s.gender, s.class_name, m.position,
            NULLIF(TRIM(s.father_name), '') AS parent_name
       FROM students s
  LEFT JOIN class_student_meta m ON m.student_id = s.id AND m.class_id = ?
      WHERE s.status = 'active'
        AND s.category_id = ?
        AND s.study_year  = ?
        AND s.generation  = ?
        AND (s.class_name IS NULL OR s.class_name = '' OR s.class_name = ?)
      ORDER BY (m.position IS NULL), m.position, s.last_name, s.first_name`,
    [cls.id, cls.category_id, cls.study_year, cls.school_year, cls.name]
  );
  return rows;
}

/** A bën ky nxënës pjesë në paralele? (mbrojtje ndaj ID-ve të huaja) */
async function assertStudentInClass(cls, studentId) {
  const roster = await rosterOf(cls);
  const student = roster.find((s) => s.id === Number(studentId));
  if (!student) throw httpError(400, 'Nxënësi nuk bën pjesë në këtë paralele.');
  return student;
}

async function subjectOf(cls, subjectId, { activeOnly = true } = {}) {
  const [[subject]] = await pool.query(
    'SELECT * FROM class_subjects WHERE id = ? AND class_id = ?',
    [subjectId, cls.id]
  );
  if (!subject) throw httpError(400, 'Lënda nuk bën pjesë në këtë paralele.');
  if (activeOnly && !subject.is_active) {
    throw httpError(400, 'Kjo lëndë është hequr nga ditari.');
  }
  return subject;
}

// ---------------------------------------------------------------
//  Paralelet (krijimi/ndryshimi — vetëm administratori)
// ---------------------------------------------------------------

async function validateClassPayload(data) {
  // Paralelja eshte thjesht numri: viti i studimit jepet vec, ndaj emri
  // 'XII-1' do te thoshte te njejten gje dy here — dhe mund te binte ne
  // kundershtim me veten.
  const nr = Number(String(data.name ?? '').trim());
  if (!Number.isInteger(nr) || nr < 1 || nr > MAX_PARALLELS) {
    throw httpError(400, `Paralelja duhet të jetë numër nga 1 deri në ${MAX_PARALLELS}.`);
  }
  const name = String(nr);

  const studyYear = Number(data.study_year);
  if (![1, 2, 3].includes(studyYear)) {
    throw httpError(400, 'Viti i studimit duhet të jetë 1, 2 ose 3.');
  }

  const schoolYear = String(data.school_year || '').trim();
  if (!/^\d{4}\/\d{4}$/.test(schoolYear)) {
    throw httpError(400, 'Viti shkollor duhet të jetë në formatin 2025/2026.');
  }

  const [[cat]] = await pool.query('SELECT id FROM categories WHERE id = ?', [data.category_id]);
  if (!cat) throw httpError(400, 'Drejtimi i zgjedhur nuk ekziston.');

  let kujdestarId = data.kujdestar_id ? Number(data.kujdestar_id) : null;
  if (kujdestarId) {
    const [[k]] = await pool.query(
      `SELECT id FROM users
        WHERE id = ? AND is_active = 1 AND role IN (${KUJDESTAR_ROLES.map(() => '?').join(',')})`,
      [kujdestarId, ...KUJDESTAR_ROLES]
    );
    if (!k) {
      throw httpError(400,
        'Kujdestari duhet të jetë përdorues aktiv me rolin «Kujdestar/e» ose «Staf».');
    }
  } else {
    kujdestarId = null;
  }

  return {
    name,
    category_id: Number(data.category_id),
    study_year: studyYear,
    school_year: schoolYear,
    kujdestar_id: kujdestarId,
  };
}

/** Mesazh qe thote SAKTESISHT cila paralele perplaset, jo vetem «ekziston». */
function duplicateMessage(payload) {
  return `Paralelja ${classLabelOf(payload.study_year, payload.name)} e këtij drejtimi `
    + `ekziston tashmë për vitin shkollor ${payload.school_year}.`;
}

async function createClass(data) {
  const payload = await validateClassPayload(data);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query('INSERT INTO classes SET ?', [payload]);
    const classId = result.insertId;

    // Faqja «e shtypur» e ditarit: lëndët e bërthamës, në renditjen e librit
    const values = DEFAULT_SUBJECTS.map(([subjectName, grp], i) => [classId, subjectName, grp, i]);
    await conn.query(
      'INSERT INTO class_subjects (class_id, name, grp, position) VALUES ?',
      [values]
    );

    await conn.commit();
    return getClass(classId);
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      throw httpError(409, duplicateMessage(payload));
    }
    throw err;
  } finally {
    conn.release();
  }
}

async function updateClass(id, data) {
  const [[existing]] = await pool.query('SELECT * FROM classes WHERE id = ?', [id]);
  if (!existing) throw httpError(404, 'Paralelja nuk u gjet.');

  const payload = await validateClassPayload({ ...existing, ...data });
  payload.is_active = data.is_active === undefined
    ? existing.is_active
    : (data.is_active ? 1 : 0);

  try {
    await pool.query('UPDATE classes SET ? WHERE id = ?', [payload, id]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw httpError(409, duplicateMessage(payload));
    }
    throw err;
  }
  return getClass(id);
}

/**
 * Fshirja lejohet vetëm kur ditari është bosh — një paralele me nota
 * është dokument shkollor dhe nuk zhduket me një klikim.
 */
async function deleteClass(id) {
  const [[cls]] = await pool.query('SELECT * FROM classes WHERE id = ?', [id]);
  if (!cls) throw httpError(404, 'Paralelja nuk u gjet.');

  // Notat, oret e mesimit DHE kontrollet e notave jane dokument shkollor.
  // Te treja varen nga paralelja me ON DELETE CASCADE, ndaj nje fshirje e
  // palejuar do t'i merrte me vete pa asnje paralajmerim. Kontrollet numerohen
  // vec: nje gabim i shenuar mbetet edhe pasi nota qe e shkaktoi fshihet, dhe
  // eshte pikerisht ajo gjurme qe deshmon se ku ndryshoi ditari.
  const [[counts]] = await pool.query(
    `SELECT (SELECT COUNT(*) FROM class_grades       WHERE class_id = ?) +
            (SELECT COUNT(*) FROM class_final_grades WHERE class_id = ?) AS grades,
            (SELECT COUNT(*) FROM lessons            WHERE class_id = ?) AS lessons,
            (SELECT COUNT(*) FROM grade_reviews      WHERE class_id = ?) AS reviews`,
    [id, id, id, id]
  );
  if (counts.grades > 0 || counts.lessons > 0 || counts.reviews > 0) {
    throw httpError(409,
      'Kjo paralele ka nota, orë mësimi ose kontrolle të regjistruara dhe nuk mund '
      + 'të fshihet. Çaktivizojeni nëse nuk përdoret më.');
  }

  await pool.query('DELETE FROM classes WHERE id = ?', [id]);
  return cls;
}

async function getClass(id) {
  const [[cls]] = await pool.query(
    `SELECT c.*, cat.name AS category_name, cat.color AS category_color,
            u.full_name AS kujdestar_name
       FROM classes c
       JOIN categories cat ON cat.id = c.category_id
  LEFT JOIN users u ON u.id = c.kujdestar_id
      WHERE c.id = ?`,
    [id]
  );
  if (!cls) throw httpError(404, 'Paralelja nuk u gjet.');
  return withLabel(cls);
}

/** Administratori sheh të gjitha paralelet; kujdestari vetëm të vetat. */
async function listClasses(user) {
  // Kontrolluesi i sheh te gjitha paralelet: detyra e tij eshte t'i
  // krahasoje me librin fizik. Shkrimin e ka vetem te e vetja.
  const seesAll = isManager(user) || isReviewer(user);
  const where = seesAll ? '1' : 'c.kujdestar_id = ?';
  const params = seesAll ? [] : [user.id];

  const [rows] = await pool.query(
    `SELECT c.*, cat.name AS category_name, cat.color AS category_color,
            u.full_name AS kujdestar_name,
            (SELECT COUNT(*) FROM students s
              WHERE s.status = 'active'
                AND s.category_id = c.category_id
                AND s.study_year  = c.study_year
                AND s.generation  = c.school_year
                AND (s.class_name IS NULL OR s.class_name = '' OR s.class_name = c.name)
            ) AS students_count,
            (SELECT COUNT(*) FROM class_grades g WHERE g.class_id = c.id) AS grades_count
       FROM classes c
       JOIN categories cat ON cat.id = c.category_id
  LEFT JOIN users u ON u.id = c.kujdestar_id
      WHERE ${where}
      ORDER BY c.school_year DESC, c.study_year, cat.name, CAST(c.name AS UNSIGNED)`,
    params
  );
  return rows.map(withLabel);
}

/** Zgjedhjet për formularin e administratorit (kujdestarët, gjeneratat). */
async function classOptions() {
  const [kujdestars] = await pool.query(
    `SELECT id, full_name, username, role FROM users
      WHERE is_active = 1 AND role IN (${KUJDESTAR_ROLES.map(() => '?').join(',')})
      ORDER BY full_name`,
    KUJDESTAR_ROLES
  );
  const [gens] = await pool.query(
    "SELECT DISTINCT generation FROM students WHERE status = 'active' ORDER BY generation DESC"
  );
  return { kujdestars, generations: gens.map((g) => g.generation) };
}

// ---------------------------------------------------------------
//  Ditari i plotë i një paraleleje — një thirrje, gjithçka
// ---------------------------------------------------------------

async function getRegister(user, classId) {
  const cls = await assertClassAccess(user, classId);
  const students = await rosterOf(cls);

  const [subjects] = await pool.query(
    `SELECT id, name, grp, position, is_active
       FROM class_subjects
      WHERE class_id = ? AND is_active = 1
      ORDER BY FIELD(grp, ${GROUPS.map(() => '?').join(',')}), position, id`,
    [classId, ...GROUPS]
  );

  const [grades] = await pool.query(
    `SELECT id, student_id, subject_id, term, value
       FROM class_grades WHERE class_id = ? ORDER BY created_at, id`,
    [classId]
  );

  const [finals] = await pool.query(
    'SELECT student_id, subject_id, term, value FROM class_final_grades WHERE class_id = ?',
    [classId]
  );

  const [meta] = await pool.query(
    `SELECT student_id, absent_just_gj1, absent_unjust_gj1,
            absent_just_gj2, absent_unjust_gj2,
            conduct_gj1, conduct_gj2, conduct_final, remark
       FROM class_student_meta WHERE class_id = ?`,
    [classId]
  );

  // Kontrollet e notave: cilat jane pranuar, cilat jane shenuar gabim
  const [reviews] = await pool.query(
    `SELECT r.id, r.student_id, r.subject_id, r.kind, r.term, r.grade_id,
            r.observed_value, r.status, r.comment, r.reviewed_by, r.reviewed_at,
            u.full_name AS reviewed_by_name
       FROM grade_reviews r
       JOIN users u ON u.id = r.reviewed_by
      WHERE r.class_id = ? AND r.status IN ('ok','error')`,
    [classId]
  );

  return {
    class: cls,
    group_labels: GROUP_LABELS,
    subjects,
    students,
    grades,
    finals,
    meta,
    reviews,
    // A i plotëson notat ky përdorues, apo vetëm i kontrollon?
    can_write: canWriteClass(user, cls),
    can_review: isReviewer(user),
    viewer_id: user.id,
  };
}

// ---------------------------------------------------------------
//  Lëndët
// ---------------------------------------------------------------

function validateSubjectPayload(data) {
  const name = String(data.name || '').trim();
  if (!name || name.length > 80) {
    throw httpError(400, 'Emri i lëndës është i detyrueshëm (deri në 80 karaktere).');
  }
  const grp = String(data.grp || 'teorike');
  if (!GROUPS.includes(grp)) throw httpError(400, 'Grupi i lëndës nuk njihet.');
  return { name, grp };
}

async function addSubject(user, classId, data) {
  const cls = await assertClassWrite(user, classId);
  const { name, grp } = validateSubjectPayload(data);

  const [[pos]] = await pool.query(
    'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM class_subjects WHERE class_id = ? AND grp = ?',
    [classId, grp]
  );
  const [result] = await pool.query(
    'INSERT INTO class_subjects SET ?',
    [{ class_id: cls.id, name, grp, position: pos.next }]
  );

  const [[subject]] = await pool.query('SELECT * FROM class_subjects WHERE id = ?', [result.insertId]);
  return { subject, class: cls };
}

async function updateSubject(user, subjectId, data) {
  const [[existing]] = await pool.query('SELECT * FROM class_subjects WHERE id = ?', [subjectId]);
  if (!existing) throw httpError(404, 'Lënda nuk u gjet.');
  const cls = await assertClassWrite(user, existing.class_id);

  const patch = {};
  if (data.name !== undefined || data.grp !== undefined) {
    const { name, grp } = validateSubjectPayload({ ...existing, ...data });
    patch.name = name;
    patch.grp = grp;
  }
  if (data.position !== undefined) {
    const p = Number(data.position);
    if (!Number.isInteger(p) || p < 0) throw httpError(400, 'Pozicioni nuk është i vlefshëm.');
    patch.position = p;
  }
  if (Object.keys(patch).length) {
    await pool.query('UPDATE class_subjects SET ? WHERE id = ?', [patch, subjectId]);
  }

  const [[subject]] = await pool.query('SELECT * FROM class_subjects WHERE id = ?', [subjectId]);
  return { subject, class: cls };
}

/**
 * Lënda pa nota fshihet; lënda me nota vetëm çaktivizohet — notat e
 * vendosura janë dokument dhe nuk zhduken bashkë me kolonën.
 */
async function removeSubject(user, subjectId) {
  const [[subject]] = await pool.query('SELECT * FROM class_subjects WHERE id = ?', [subjectId]);
  if (!subject) throw httpError(404, 'Lënda nuk u gjet.');
  const cls = await assertClassWrite(user, subject.class_id);

  // Edhe oret e mesimit varen nga kjo lende (ON DELETE CASCADE): pa kete
  // kontroll, heqja e nje kolone do te fshinte ne heshtje ditarin e oreve.
  const [[counts]] = await pool.query(
    `SELECT (SELECT COUNT(*) FROM class_grades       WHERE subject_id = ?) +
            (SELECT COUNT(*) FROM class_final_grades WHERE subject_id = ?) +
            (SELECT COUNT(*) FROM lessons            WHERE subject_id = ?) AS total`,
    [subjectId, subjectId, subjectId]
  );

  if (counts.total > 0) {
    await pool.query('UPDATE class_subjects SET is_active = 0 WHERE id = ?', [subjectId]);
    return { subject, class: cls, deactivated: true };
  }
  await pool.query('DELETE FROM class_subjects WHERE id = ?', [subjectId]);
  return { subject, class: cls, deactivated: false };
}

// ---------------------------------------------------------------
//  Notat e vazhdueshme (rreshtat I dhe II)
// ---------------------------------------------------------------

async function addGrade(user, classId, data) {
  const cls = await assertClassWrite(user, classId);
  const term = assertTerm(data.term);
  const value = assertGradeValue(data.value);
  const student = await assertStudentInClass(cls, data.student_id);
  const subject = await subjectOf(cls, data.subject_id);

  const [[count]] = await pool.query(
    'SELECT COUNT(*) AS c FROM class_grades WHERE student_id = ? AND subject_id = ? AND term = ?',
    [student.id, subject.id, term]
  );
  if (count.c >= MAX_GRADES_PER_CELL) {
    throw httpError(400, `Qeliza mban më së shumti ${MAX_GRADES_PER_CELL} nota — fshini një notë të gabuar përpara se të shtoni tjetër.`);
  }

  const [result] = await pool.query('INSERT INTO class_grades SET ?', [{
    class_id: cls.id,
    student_id: student.id,
    subject_id: subject.id,
    term,
    value,
    graded_by: user.id,
  }]);

  return {
    grade: { id: result.insertId, student_id: student.id, subject_id: subject.id, term, value },
    class: cls,
    student,
    subject,
    term_label: TERM_LABELS[term],
  };
}

async function removeGrade(user, gradeId) {
  const [[grade]] = await pool.query(
    `SELECT g.*, cs.name AS subject_name,
            CONCAT(s.first_name, ' ', s.last_name) AS student_name
       FROM class_grades g
       JOIN class_subjects cs ON cs.id = g.subject_id
       JOIN students s ON s.id = g.student_id
      WHERE g.id = ?`,
    [gradeId]
  );
  if (!grade) throw httpError(404, 'Nota nuk u gjet.');
  const cls = await assertClassWrite(user, grade.class_id);

  // Gabimi i shënuar mbi këtë notë u rregullua duke e hequr atë
  await autoResolveReviews({
    studentId: grade.student_id, subjectId: grade.subject_id,
    term: grade.term, kind: 'mark', gradeId: Number(gradeId), userId: user.id,
  });
  await pool.query('DELETE FROM class_grades WHERE id = ?', [gradeId]);
  return { grade, class: cls, term_label: TERM_LABELS[grade.term] };
}

// ---------------------------------------------------------------
//  Nota përfundimtare (N.P. — shifra e kuqe)
// ---------------------------------------------------------------

async function setFinalGrade(user, classId, data) {
  const cls = await assertClassWrite(user, classId);
  const student = await assertStudentInClass(cls, data.student_id);
  const subject = await subjectOf(cls, data.subject_id);
  const term = assertFinalTerm(data.term);

  const [[existing]] = await pool.query(
    'SELECT value FROM class_final_grades WHERE subject_id = ? AND student_id = ? AND term = ?',
    [subject.id, student.id, term]
  );

  const finish = async () => {
    // Nota ndryshoi: gabimi i shënuar mbi të s'ka më kuptim, mbyllet vetë.
    await autoResolveReviews({
      studentId: student.id, subjectId: subject.id, term, kind: 'closing',
      userId: user.id,
    });
  };

  // value = null e heq mbylljen (u vendos gabimisht)
  if (data.value === null || data.value === undefined || data.value === '') {
    await pool.query(
      'DELETE FROM class_final_grades WHERE subject_id = ? AND student_id = ? AND term = ?',
      [subject.id, student.id, term]
    );
    await finish();
    return {
      removed: true, class: cls, student, subject, term, value: null,
      term_label: FINAL_TERM_LABELS[term],
    };
  }

  const value = assertGradeValue(data.value);
  await pool.query(
    `INSERT INTO class_final_grades (class_id, student_id, subject_id, term, value, decided_by)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value), decided_by = VALUES(decided_by)`,
    [cls.id, student.id, subject.id, term, value, user.id]
  );
  await finish();
  return {
    removed: false, class: cls, student, subject, term, value,
    term_label: FINAL_TERM_LABELS[term],
    old_value: existing ? existing.value : null,
  };
}

// ---------------------------------------------------------------
//  Mungesat, sjellja, vërejtja
// ---------------------------------------------------------------

/**
 * Ruan rendin e nxënësve në ditar.
 *
 * Pranohet vetëm një listë e plotë: pikërisht të njëjtët nxënës si në
 * paralele, secili një herë. Kështu një listë e vjetruar — p.sh. e hapur
 * para se të regjistrohej dikush i ri — nuk e fshin fshehurazi askënd
 * nga rendi; kujdestari e rifreskon faqen dhe e ruan sërish.
 */
async function saveStudentOrder(user, classId, studentIds) {
  const cls = await assertClassWrite(user, classId);
  const roster = await rosterOf(cls);

  const ids = Array.isArray(studentIds) ? studentIds.map(Number) : [];
  const known = new Set(roster.map((s) => s.id));

  if (ids.length !== roster.length
    || new Set(ids).size !== ids.length
    || ids.some((id) => !known.has(id))) {
    throw httpError(400,
      'Lista e rendit nuk përputhet me nxënësit e paraleles. '
      + 'Rifreskoni faqen dhe provoni sërish.');
  }

  const values = ids.map((studentId, i) => [cls.id, studentId, i, user.id]);
  await pool.query(
    `INSERT INTO class_student_meta (class_id, student_id, position, updated_by)
     VALUES ?
     ON DUPLICATE KEY UPDATE position = VALUES(position), updated_by = VALUES(updated_by)`,
    [values]
  );

  return { class: cls, count: ids.length };
}

async function saveStudentMeta(user, classId, studentId, data) {
  const cls = await assertClassWrite(user, classId);
  const student = await assertStudentInClass(cls, studentId);

  const row = {
    class_id: cls.id,
    student_id: student.id,
    absent_just_gj1: assertAbsences(data.absent_just_gj1 ?? 0, 'të arsyeshme, Gj. I'),
    absent_unjust_gj1: assertAbsences(data.absent_unjust_gj1 ?? 0, 'të paarsyeshme, Gj. I'),
    absent_just_gj2: assertAbsences(data.absent_just_gj2 ?? 0, 'të arsyeshme, Gj. II'),
    absent_unjust_gj2: assertAbsences(data.absent_unjust_gj2 ?? 0, 'të paarsyeshme, Gj. II'),
    conduct_gj1: assertConduct(data.conduct_gj1, 'Gj. I'),
    conduct_gj2: assertConduct(data.conduct_gj2, 'Gj. II'),
    conduct_final: assertConduct(data.conduct_final, 'përfundimtare'),
    remark: data.remark ? String(data.remark).slice(0, 500) : null,
    updated_by: user.id,
  };

  await pool.query(
    `INSERT INTO class_student_meta SET ?
     ON DUPLICATE KEY UPDATE
       absent_just_gj1 = VALUES(absent_just_gj1),
       absent_unjust_gj1 = VALUES(absent_unjust_gj1),
       absent_just_gj2 = VALUES(absent_just_gj2),
       absent_unjust_gj2 = VALUES(absent_unjust_gj2),
       conduct_gj1 = VALUES(conduct_gj1),
       conduct_gj2 = VALUES(conduct_gj2),
       conduct_final = VALUES(conduct_final),
       remark = VALUES(remark),
       updated_by = VALUES(updated_by)`,
    [row]
  );

  return { meta: row, class: cls, student };
}

// ---------------------------------------------------------------
//  Kontrolli i notave — pranimi ose shënimi i një gabimi
// ---------------------------------------------------------------

const REVIEW_KINDS = ['mark', 'closing'];

/**
 * Mbyll vetvetiu gabimet e hapura për një qelizë, sepse nota ndryshoi.
 *
 * Pa këtë, kujdestari do të duhej ta korrigjonte notën dhe MË PAS të
 * kujtohej ta mbyllte edhe njoftimin — dhe lista do të mbushej me
 * gabime tashmë të rregulluara, derisa askush s'do t'i besonte më.
 */
async function autoResolveReviews({ studentId, subjectId, term, kind, gradeId = null, userId = null }) {
  const where = ['status = ?', 'student_id = ?', 'subject_id = ?', 'term = ?', 'kind = ?'];
  const params = ['error', studentId, subjectId, term, kind];
  if (gradeId !== null) {
    where.push('grade_id = ?');
    params.push(gradeId);
  }
  // Kush e mbylli gabimin ruhet: nje gjurme pa emer nuk eshte gjurme.
  await pool.query(
    `UPDATE grade_reviews SET status = 'resolved', resolved_by = ?, resolved_at = NOW()
      WHERE ${where.join(' AND ')}`,
    [userId, ...params]
  );
}

/**
 * Stafi kalon nëpër ditar dhe për çdo notë ose e pranon, ose e shënon
 * si gabim me koment. Nuk e ndryshon dot: korrigjimi i takon kujdestarit.
 */
async function reviewGrade(user, classId, data) {
  const cls = await assertClassAccess(user, classId);
  if (!isReviewer(user)) {
    throw httpError(403, 'Nuk keni të drejta për kontrollin e notave.');
  }

  const student = await assertStudentInClass(cls, data.student_id);
  const subject = await subjectOf(cls, data.subject_id);

  const kind = REVIEW_KINDS.includes(data.kind) ? data.kind : null;
  if (!kind) throw httpError(400, 'Lloji i kontrollit nuk njihet.');

  const status = data.status === 'error' ? 'error' : 'ok';
  const comment = String(data.comment || '').trim();
  if (status === 'error' && comment.length < 3) {
    throw httpError(400, 'Shkruani te paktën me pak fjalë se ku qëndron gabimi.');
  }

  // Nota duhet të ekzistojë ende: pa këtë do të shënoheshin gabime mbi
  // nota të fshira, dhe kujdestari s'do të dinte çfarë të korrigjonte.
  let term;
  let gradeId = null;
  let observed;

  if (kind === 'mark') {
    const [[grade]] = await pool.query(
      'SELECT * FROM class_grades WHERE id = ? AND class_id = ?',
      [data.grade_id, cls.id]
    );
    if (!grade) throw httpError(404, 'Kjo notë nuk ekziston më në ditar.');
    if (grade.student_id !== student.id || grade.subject_id !== subject.id) {
      throw httpError(400, 'Nota nuk i përket kësaj qelize.');
    }
    term = grade.term;
    gradeId = grade.id;
    observed = grade.value;
  } else {
    term = assertFinalTerm(data.term);
    const [[closing]] = await pool.query(
      'SELECT value FROM class_final_grades WHERE subject_id = ? AND student_id = ? AND term = ?',
      [subject.id, student.id, term]
    );
    if (!closing) throw httpError(404, 'Kjo mbyllje nuk është vendosur ende.');
    observed = closing.value;
  }

  // Një kontroll i vetëm i gjallë për çdo notë: mendimi i fundit vlen.
  const dup = ['class_id = ?', 'student_id = ?', 'subject_id = ?', 'term = ?', 'kind = ?',
    "status IN ('ok','error')"];
  const dupParams = [cls.id, student.id, subject.id, term, kind];
  if (kind === 'mark') { dup.push('grade_id = ?'); dupParams.push(gradeId); }
  await pool.query(`DELETE FROM grade_reviews WHERE ${dup.join(' AND ')}`, dupParams);

  const [result] = await pool.query('INSERT INTO grade_reviews SET ?', [{
    class_id: cls.id,
    student_id: student.id,
    subject_id: subject.id,
    kind,
    term,
    grade_id: gradeId,
    observed_value: observed,
    status,
    comment: status === 'error' ? comment.slice(0, 500) : null,
    reviewed_by: user.id,
  }]);

  return {
    id: result.insertId, class: cls, student, subject, kind, term, status,
    value: observed, comment: status === 'error' ? comment : null,
    term_label: FINAL_TERM_LABELS[term] || TERM_LABELS[term],
  };
}

module.exports = {
  MAX_PARALLELS,
  classLabelOf,
  GROUP_LABELS,
  FINAL_TERM_LABELS,
  listClasses,
  classOptions,
  createClass,
  updateClass,
  deleteClass,
  getRegister,
  addSubject,
  updateSubject,
  removeSubject,
  addGrade,
  removeGrade,
  setFinalGrade,
  saveStudentMeta,
  saveStudentOrder,
  reviewGrade,
};