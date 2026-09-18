const pool = require('../config/db');
const { httpError } = require('../middleware/errorHandler');

/**
 * Profesorët dhe lëndët që japin.
 *
 * Profesori NUK është përdorues i sistemit: ai nuk kyçet askund. Orët e
 * mësimit i bart dikush nga administrata, nga ditari fizik në atë
 * dixhital. Prandaj këtu nuk ka emër përdoruesi as fjalëkalim — vetëm
 * emri, lëndët dhe nëse është ende në punë.
 *
 * Një profesor jep disa lëndë; një lëndë jepet nga disa profesorë —
 * zakonisht 2–3. Lidhja ruhet te `professor_subjects`.
 */

const GROUPS = ['gjuhet', 'matematika', 'shkencat', 'shoqeria', 'sportet',
  'teknologjia', 'teorike', 'praktike'];

function assertFullName(name) {
  const n = String(name || '').trim().replace(/\s+/g, ' ');
  if (n.length < 3) throw httpError(400, 'Shkruani emrin dhe mbiemrin e profesorit.');
  return n.slice(0, 120);
}

// ---------------------------------------------------------------
//  Katalogu i lëndëve
// ---------------------------------------------------------------

/** Lëndët e shkollës, me numrin e profesorëve që e japin secilën. */
async function listSubjects() {
  const [rows] = await pool.query(
    `SELECT s.id, s.name, s.grp, s.is_active,
            COUNT(DISTINCT ps.professor_id) AS professor_count
       FROM subjects s
  LEFT JOIN professor_subjects ps ON ps.subject_id = s.id
      GROUP BY s.id, s.name, s.grp, s.is_active
      ORDER BY s.name`
  );

  const [links] = await pool.query(
    `SELECT sc.subject_id, sc.category_id, c.name, c.code
       FROM subject_categories sc
       JOIN categories c ON c.id = sc.category_id
      ORDER BY c.name`
  );

  const bySubject = {};
  links.forEach((l) => {
    (bySubject[l.subject_id] = bySubject[l.subject_id] || []).push({
      id: l.category_id, name: l.name, code: l.code,
    });
  });

  return rows.map((r) => ({
    ...r,
    professor_count: Number(r.professor_count),
    categories: bySubject[r.id] || [],
  }));
}

async function replaceSubjectCategories(conn, subjectId, categoryIds) {
  await conn.query('DELETE FROM subject_categories WHERE subject_id = ?', [subjectId]);

  const ids = [...new Set((Array.isArray(categoryIds) ? categoryIds : [])
    .map(Number).filter(Number.isInteger))];
  if (!ids.length) return [];

  await conn.query(
    `INSERT IGNORE INTO subject_categories (subject_id, category_id) VALUES ${
      ids.map(() => '(?, ?)').join(', ')}`,
    ids.flatMap((cid) => [subjectId, cid])
  );
  return ids;
}

async function setSubjectCategories(subjectId, categoryIds) {
  const [[subject]] = await pool.query(
    'SELECT id, name FROM subjects WHERE id = ?', [subjectId]
  );
  if (!subject) throw httpError(404, 'Lënda nuk u gjet.');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await replaceSubjectCategories(conn, subject.id, categoryIds);
    await conn.commit();
    return subject;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function deleteSubject(id) {
  const [[subject]] = await pool.query(
    'SELECT id, name FROM subjects WHERE id = ?', [id]
  );
  if (!subject) throw httpError(404, 'Lënda nuk u gjet.');

  const [[used]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM professor_subjects WHERE subject_id = ?) AS professors,
       (SELECT COUNT(*) FROM class_subjects     WHERE subject_id = ?) AS classes,
       (SELECT COUNT(*)
          FROM lessons l
          JOIN class_subjects cs ON cs.id = l.subject_id
         WHERE cs.subject_id = ?)                                     AS lessons`,
    [id, id, id]
  );

  const blockers = [];
  if (Number(used.professors)) blockers.push(`${used.professors} profesorë`);
  if (Number(used.classes)) blockers.push(`${used.classes} paralele`);
  if (Number(used.lessons)) blockers.push(`${used.lessons} orë mësimi`);

  if (blockers.length) {
    throw httpError(
      409,
      `Lënda «${subject.name}» nuk fshihet dot: përdoret nga ${blockers.join(' dhe ')}.`
    );
  }

  await pool.query('DELETE FROM subjects WHERE id = ?', [id]);
  return subject;
}

async function createSubject(data) {
  const name = String(data.name || '').trim();
  if (name.length < 2) throw httpError(400, 'Shkruani emrin e lëndës.');
  const grp = GROUPS.includes(data.grp) ? data.grp : 'teorike';

  try {
    const [r] = await pool.query('INSERT INTO subjects SET ?', [{ name: name.slice(0, 80), grp }]);
    if (Array.isArray(data.category_ids) && data.category_ids.length) {
      const conn = await pool.getConnection();
      try {
        await replaceSubjectCategories(conn, r.insertId, data.category_ids);
      } finally {
        conn.release();
      }
    }
    return { id: r.insertId, name, grp };
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw httpError(409, `Lënda «${name}» ekziston tashmë në katalog.`);
    }
    throw err;
  }
}

// ---------------------------------------------------------------
//  Profesorët
// ---------------------------------------------------------------

/**
 * Profesorët me lëndët e secilit.
 *
 * DY pyetje, jo një me GROUP_CONCAT: bashkimi i id-ve dhe i emrave në dy
 * lista teksti dhe çiftimi i tyre sipas indeksit ishte i brishtë —
 * mjaftonte një ndarës brenda emrit të lëndës ose kufiri
 * `group_concat_max_len` (1024 bajt si parazgjedhje) që emrat t'u
 * ngjiteshin id-ve të gabuara. Kështu nuk ka tekst për t'u zbërthyer.
 *
 * Numri i orëve merret si nënpyetje, jo si LEFT JOIN: një bashkim me
 * `lessons` shumëzon rreshtat për çdo lëndë të profesorit.
 */
async function listProfessors() {
  const [rows] = await pool.query(
    `SELECT p.id, p.full_name, p.is_active,
            (SELECT COUNT(*) FROM lessons l WHERE l.professor_id = p.id) AS lesson_count
       FROM professors p
      ORDER BY p.is_active DESC, p.full_name`
  );

  const [links] = await pool.query(
    `SELECT ps.professor_id, s.id, s.name
       FROM professor_subjects ps
       JOIN subjects s ON s.id = ps.subject_id
      ORDER BY s.name`
  );

  const byProfessor = new Map();
  links.forEach((l) => {
    if (!byProfessor.has(l.professor_id)) byProfessor.set(l.professor_id, []);
    byProfessor.get(l.professor_id).push({ id: l.id, name: l.name });
  });

  return rows.map((r) => ({
    id: r.id,
    full_name: r.full_name,
    is_active: r.is_active,
    lesson_count: Number(r.lesson_count),
    subjects: byProfessor.get(r.id) || [],
  }));
}

async function loadProfessor(id) {
  const [[p]] = await pool.query('SELECT * FROM professors WHERE id = ?', [id]);
  if (!p) throw httpError(404, 'Profesori nuk u gjet.');
  return p;
}

async function createProfessor(data) {
  const full_name = assertFullName(data.full_name);

  // Dy profesorë me të njëjtin emër do të ishin të padallueshëm te
  // zgjedhësi i orës, ndaj ndalohet.
  const [[twin]] = await pool.query(
    'SELECT id FROM professors WHERE full_name = ?', [full_name]
  );
  if (twin) throw httpError(409, `Profesori «${full_name}» ekziston tashmë.`);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query('INSERT INTO professors SET ?', [{ full_name, is_active: 1 }]);
    await replaceSubjects(conn, r.insertId, data.subject_ids);
    await conn.commit();
    return { id: r.insertId, full_name };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function updateProfessor(id, data) {
  const prof = await loadProfessor(id);

  const patch = {};
  if (data.full_name !== undefined) {
    patch.full_name = assertFullName(data.full_name);
    if (patch.full_name !== prof.full_name) {
      const [[twin]] = await pool.query(
        'SELECT id FROM professors WHERE full_name = ? AND id <> ?', [patch.full_name, id]
      );
      if (twin) throw httpError(409, `Profesori «${patch.full_name}» ekziston tashmë.`);
    }
  }
  if (data.is_active !== undefined) patch.is_active = data.is_active ? 1 : 0;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (Object.keys(patch).length) {
      await conn.query('UPDATE professors SET ? WHERE id = ?', [patch, id]);
    }
    if (data.subject_ids !== undefined) {
      await replaceSubjects(conn, id, data.subject_ids);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return { ...prof, ...patch };
}

/**
 * Fshirja lejohet vetëm derisa profesori s'ka orë të shënuara. Pas kësaj
 * ai çaktivizohet: fshirja do të hiqte edhe gjurmën e orëve të mbajtura,
 * dhe raporti i një muaji të kaluar do të ndryshonte vite më vonë.
 */
async function deleteProfessor(id) {
  const prof = await loadProfessor(id);
  const [[used]] = await pool.query(
    'SELECT COUNT(*) AS n FROM lessons WHERE professor_id = ? OR substitute_for = ?',
    [id, id]
  );
  if (Number(used.n) > 0) {
    throw httpError(409,
      `${prof.full_name} ka ${used.n} orë të shënuara dhe nuk fshihet — çaktivizojeni.`);
  }
  await pool.query('DELETE FROM professors WHERE id = ?', [id]);
  return prof;
}

/** Zëvendëson lëndët e një profesori me listën e re. */
async function replaceSubjects(conn, professorId, subjectIds) {
  const ids = Array.isArray(subjectIds)
    ? [...new Set(subjectIds.map(Number).filter(Number.isInteger))]
    : [];

  if (ids.length) {
    const [valid] = await conn.query(
      `SELECT id FROM subjects WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids
    );
    if (valid.length !== ids.length) {
      throw httpError(400, 'Një nga lëndët e zgjedhura nuk ekziston.');
    }
  }

  if (ids.length === 0) {
    await conn.query('DELETE FROM professor_subjects WHERE professor_id = ?', [professorId]);
    return;
  }

  // Fshihen vetem ato qe s'jane me ne liste, dhe shtohen te rejat.
  await conn.query(
    `DELETE FROM professor_subjects
      WHERE professor_id = ? AND subject_id NOT IN (${ids.map(() => '?').join(',')})`,
    [professorId, ...ids]
  );
  await conn.query(
    `INSERT IGNORE INTO professor_subjects (professor_id, subject_id) VALUES ${
      ids.map(() => '(?, ?)').join(', ')}`,
    ids.flatMap((sid) => [professorId, sid])
  );
}

/** Profesorët sipas lëndës — dritarja e orës ngushton listën me këtë. */
async function professorsBySubject() {
  const [rows] = await pool.query(
    `SELECT ps.subject_id, ps.professor_id
       FROM professor_subjects ps
       JOIN professors p ON p.id = ps.professor_id
      WHERE p.is_active = 1`
  );
  const map = {};
  for (const r of rows) {
    (map[r.subject_id] = map[r.subject_id] || []).push(r.professor_id);
  }
  return map;
}

module.exports = {
  deleteSubject, setSubjectCategories,
  listSubjects,
  createSubject,
  listProfessors,
  createProfessor,
  updateProfessor,
  deleteProfessor,
  professorsBySubject,
};