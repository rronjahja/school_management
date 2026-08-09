const pool = require('../config/db');
const { httpError } = require('../middleware/errorHandler');
const { can, isManager, isReviewer } = require('../config/roles');
const registerService = require('./registerService');
const professorService = require('./professorService');

/**
 * Ditari i orëve të mësimit — libri «Orët e mësimit sipas fushave dhe
 * lëndëve mësimore». Çdo ditë pune ka deri në 7 orë; profesori shënon
 * lëndën dhe temën e orës që mbajti.
 *
 * Profesorët nuk kyçen në sistem: orët i bart dikush nga administrata,
 * nga ditari fizik në atë dixhital. Prandaj «kush e mbajti orën» është
 * gjithnjë një zgjedhje nga lista e profesorëve, jo përdoruesi që shkruan.
 *
 * RREGULLAT E SHKRIMIT (të gjitha zbatohen KËTU, në server):
 *   · shkruajnë stafi, menaxheri dhe administratori
 *   · kujdestari e sheh ditarin e paraleles së vet, por nuk e plotëson
 *   · zëvendësimi: ora i numërohet atij që e MBAJTI (professor_id);
 *     kush mungoi ruhet te substitute_for, sa për gjurmë
 *
 * KONTROLLI: si te notat — stafi e krahason çdo orë me librin fizik dhe
 * ose e pranon, ose e shënon gabim me koment. Çdo ndryshim i orës e
 * kthen kontrollin në 'none': ora e ndryshuar duhet parë sërish.
 */

const MAX_PERIOD = 7;

const DAY_NAMES = ['E diel', 'E hënë', 'E martë', 'E mërkurë', 'E enjte', 'E premte', 'E shtunë'];

// ---------------------------------------------------------------
//  Vërtetime
// ---------------------------------------------------------------

function assertPeriod(period) {
    const p = Number(period);
    if (!Number.isInteger(p) || p < 1 || p > MAX_PERIOD) {
        throw httpError(400, `Ora duhet të jetë numër nga 1 deri në ${MAX_PERIOD}.`);
    }
    return p;
}

/**
 * Data duhet të jetë ditë pune (e hënë – e premte): rrjeta e librit ka
 * vetëm ato ditë, ndaj një orë e shtunë do të shkruhej e s'do të dukej
 * askund — gabimi më i keq është ai që nuk shihet.
 */
function assertLessonDate(value) {
    const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) throw httpError(400, 'Data duhet të jetë në formatin 2025-09-09.');
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    if (Number.isNaN(d.getTime()) || d.getUTCDate() !== Number(m[3])) {
        throw httpError(400, 'Data nuk është e vlefshme.');
    }
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) {
        throw httpError(400, `${DAY_NAMES[dow]} nuk është ditë mësimi — zgjidhni nga e hëna në të premte.`);
    }
    return m[0];
}

function assertMonth(value) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ''))) {
        throw httpError(400, 'Muaji duhet të jetë në formatin 2025-09.');
    }
    return value;
}

async function assertProfessor(professorId, label) {
    const [[u]] = await pool.query(
        'SELECT id, full_name FROM professors WHERE id = ? AND is_active = 1',
        [professorId]
    );
    if (!u) throw httpError(400, `${label} duhet të jetë profesor aktiv.`);
    return u;
}

// ---------------------------------------------------------------
//  Qasja
// ---------------------------------------------------------------

/**
 * Kush e HAP ditarin e orëve të një paraleleje: kushdo me zonën 'mesimi'.
 * Profesori jep mësim nëpër shumë paralele, ndaj i hap të gjitha; po
 * ashtu stafi që kontrollon. Kujdestari pa zonë tjetër hap vetëm të vetën.
 */
async function assertLessonAccess(user, classId) {
    if (!can(user, 'mesimi')) {
        throw httpError(403, 'Nuk keni qasje në ditarin e orëve të mësimit.');
    }
    const [[cls]] = await pool.query(
        `SELECT c.*, cat.name AS category_name, cat.color AS category_color
       FROM classes c
       JOIN categories cat ON cat.id = c.category_id
      WHERE c.id = ?`,
        [classId]
    );
    if (!cls) throw httpError(404, 'Paralelja nuk u gjet.');
    cls.label = registerService.classLabelOf(cls.study_year, cls.name);

    if (user.role === 'kujdestar' && cls.kujdestar_id !== user.id) {
        throw httpError(403, 'Ju hapni vetëm ditarin e paraleles suaj.');
    }
    return cls;
}

/** Administron orët (shkruan çdo orë, bën zëvendësime): staf e lart. */
const canAdminLessons = (user) => isManager(user) || isReviewer(user);

/**
 * A e ndryshon dot KËTË orë ky përdorues?
 * Profesori: vetëm orët e veta, dhe vetëm sa s'janë pranuar nga stafi —
 * një orë e pranuar përputhet me librin fizik, ndaj nuk lëviz më lirshëm.
 */
function assertLessonEdit(user, lesson) {
    if (canAdminLessons(user)) return;
    throw httpError(403, 'Orët e mësimit i plotëson dhe i ndryshon vetëm administrata.');
}

// ---------------------------------------------------------------
//  Leximi
// ---------------------------------------------------------------

/** Paralelet ku mund të hapet ditari i orëve — për zgjedhësin e faqes. */
async function listClasses(user) {
    if (!can(user, 'mesimi')) throw httpError(403, 'Nuk keni qasje në ditarin e orëve.');
    const where = user.role === 'kujdestar' ? 'c.kujdestar_id = ? AND' : '';
    const params = user.role === 'kujdestar' ? [user.id] : [];
    const [rows] = await pool.query(
        `SELECT c.*, cat.name AS category_name, cat.color AS category_color
       FROM classes c
       JOIN categories cat ON cat.id = c.category_id
      WHERE ${where} c.is_active = 1
      ORDER BY c.school_year DESC, c.study_year, cat.name, CAST(c.name AS UNSIGNED)`,
        params
    );
    return rows.map((c) => ({ ...c, label: registerService.classLabelOf(c.study_year, c.name) }));
}

/** Ditari i një muaji: orët + lëndët e paraleles + kush shkruan dot. */
async function getMonth(user, classId, month) {
    const cls = await assertLessonAccess(user, classId);
    assertMonth(month);

    const [lessons] = await pool.query(
        `SELECT l.id, l.lesson_date, l.period, l.subject_id, l.topic,
            l.professor_id, l.substitute_for,
            l.review_status, l.review_comment, l.reviewed_at,
            cs.name AS subject_name,
            p.full_name AS professor_name,
            m.full_name AS substitute_for_name,
            r.full_name AS reviewed_by_name
       FROM lessons l
       JOIN class_subjects cs ON cs.id = l.subject_id
       JOIN professors p ON p.id = l.professor_id
  LEFT JOIN professors m ON m.id = l.substitute_for
  LEFT JOIN users r ON r.id = l.reviewed_by
      WHERE l.class_id = ? AND DATE_FORMAT(l.lesson_date, '%Y-%m') = ?
      ORDER BY l.lesson_date, l.period`,
        [classId, month]
    );

    const [subjects] = await pool.query(
        `SELECT id, name, grp FROM class_subjects
      WHERE class_id = ? AND is_active = 1
      ORDER BY name`,
        [classId]
    );

    const [professors] = await pool.query(
        'SELECT id, full_name FROM professors WHERE is_active = 1 ORDER BY full_name'
    );

    return {
        class: cls,
        month,
        lessons: lessons.map((l) => ({ ...l, lesson_date: toISODate(l.lesson_date) })),
        subjects,
        professors,
        can_admin: canAdminLessons(user),
        can_review: isReviewer(user),
        viewer_id: user.id,
    };
}

/** Data si '2025-09-09', pavarësisht si e kthen shtresa e MySQL-it. */
function toISODate(d) {
    if (typeof d === 'string') return d.slice(0, 10);
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------
//  Shkrimi
// ---------------------------------------------------------------

async function validatePayload(user, cls, data) {
    const lesson_date = assertLessonDate(data.lesson_date);
    const period = assertPeriod(data.period);

    const topic = String(data.topic || '').trim();
    if (topic.length < 3) {
        throw httpError(400, 'Shkruani njësinë mësimore (të paktën 3 karaktere).');
    }

    const [[subject]] = await pool.query(
        'SELECT id, name FROM class_subjects WHERE id = ? AND class_id = ? AND is_active = 1',
        [data.subject_id, cls.id]
    );
    if (!subject) throw httpError(400, 'Lënda nuk bën pjesë në këtë paralele.');

    // Kush e mbajti orën — zgjidhet gjithnjë nga lista e profesorëve.
    const professorId = Number(data.professor_id);
    await assertProfessor(professorId, 'Mbajtësi i orës');

    // Zëvendësimi: kush mungoi. S'mund të mungosh nga ora që e mban vetë.
    let substituteFor = data.substitute_for ? Number(data.substitute_for) : null;
    if (substituteFor) {
        if (substituteFor === professorId) {
            throw httpError(400, 'Mbajtësi i orës dhe profesori që mungon nuk mund të jenë i njëjti.');
        }
        await assertProfessor(substituteFor, 'Profesori që mungon');
    } else {
        substituteFor = null;
    }

    return {
        lesson_date, period, topic: topic.slice(0, 500),
        subject_id: subject.id, subject_name: subject.name,
        professor_id: professorId, substitute_for: substituteFor,
    };
}

async function createLesson(user, classId, data) {
    const cls = await assertLessonAccess(user, classId);
    if (user.role === 'kujdestar') {
        throw httpError(403, 'Orët e mësimit i plotëson administrata.');
    }
    const v = await validatePayload(user, cls, data);

    try {
        const [result] = await pool.query('INSERT INTO lessons SET ?', [{
            class_id: cls.id,
            lesson_date: v.lesson_date,
            period: v.period,
            subject_id: v.subject_id,
            professor_id: v.professor_id,
            substitute_for: v.substitute_for,
            topic: v.topic,
            created_by: user.id,
        }]);
        return { id: result.insertId, ...v, class: cls };
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            throw httpError(409,
                `Ora ${v.period} e datës ${v.lesson_date.split('-').reverse().join('/')} `
                + 'është shënuar tashmë — hapeni për ta ndryshuar.');
        }
        throw err;
    }
}

async function loadLesson(lessonId) {
    const [[lesson]] = await pool.query(
        `SELECT l.*, c.name AS class_name, c.study_year, c.kujdestar_id,
            cs.name AS subject_name, p.full_name AS professor_name
       FROM lessons l
       JOIN classes c ON c.id = l.class_id
       JOIN class_subjects cs ON cs.id = l.subject_id
       JOIN professors p ON p.id = l.professor_id
      WHERE l.id = ?`,
        [lessonId]
    );
    if (!lesson) throw httpError(404, 'Ora nuk u gjet.');
    lesson.class_label = registerService.classLabelOf(lesson.study_year, lesson.class_name);
    return lesson;
}

async function updateLesson(user, lessonId, data) {
    const lesson = await loadLesson(lessonId);
    const cls = await assertLessonAccess(user, lesson.class_id);
    assertLessonEdit(user, lesson);

    const v = await validatePayload(user, cls, {
        ...lesson, ...data,
        lesson_date: data.lesson_date ?? toISODate(lesson.lesson_date)
    });

    try {
        // Ora e ndryshuar duhet kontrolluar sërish — pa përjashtim
        await pool.query(
            `UPDATE lessons
          SET lesson_date = ?, period = ?, subject_id = ?, professor_id = ?,
              substitute_for = ?, topic = ?,
              review_status = 'none', review_comment = NULL,
              reviewed_by = NULL, reviewed_at = NULL
        WHERE id = ?`,
            [v.lesson_date, v.period, v.subject_id, v.professor_id, v.substitute_for, v.topic, lessonId]
        );
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            throw httpError(409, `Ora ${v.period} e asaj date është zënë nga një shënim tjetër.`);
        }
        throw err;
    }
    return { id: Number(lessonId), ...v, class: cls };
}

async function deleteLesson(user, lessonId) {
    const lesson = await loadLesson(lessonId);
    await assertLessonAccess(user, lesson.class_id);
    assertLessonEdit(user, lesson);

    await pool.query('DELETE FROM lessons WHERE id = ?', [lessonId]);
    return lesson;
}

// ---------------------------------------------------------------
//  Kontrolli (stafi)
// ---------------------------------------------------------------

async function reviewLesson(user, lessonId, data) {
    if (!isReviewer(user)) {
        throw httpError(403, 'Nuk keni të drejta për kontrollin e orëve.');
    }
    const lesson = await loadLesson(lessonId);

    const status = data.status === 'error' ? 'error' : 'ok';
    const comment = String(data.comment || '').trim();
    if (status === 'error' && comment.length < 3) {
        throw httpError(400, 'Shkruani me pak fjalë se ku qëndron gabimi.');
    }

    await pool.query(
        `UPDATE lessons
        SET review_status = ?, review_comment = ?, reviewed_by = ?, reviewed_at = NOW()
      WHERE id = ?`,
        [status, status === 'error' ? comment.slice(0, 500) : null, user.id, lessonId]
    );
    return { ...lesson, review_status: status, review_comment: comment || null };
}

// ---------------------------------------------------------------
//  Raporti mujor
// ---------------------------------------------------------------

/**
 * Sa orë mbajti secili profesor gjatë muajit — numërimi shkon te ai që
 * e MBAJTI orën, ndaj zëvendësimet i numërohen zëvendësuesit vetvetiu.
 */
async function monthlyReport(user, month, classId = null) {
    if (!can(user, 'mesimi')) throw httpError(403, 'Nuk keni qasje në raportin e orëve.');
    assertMonth(month);

    const where = ["DATE_FORMAT(l.lesson_date, '%Y-%m') = ?"];
    const params = [month];
    if (classId) { where.push('l.class_id = ?'); params.push(Number(classId)); }
    if (user.role === 'kujdestar') {
        where.push('l.class_id IN (SELECT id FROM classes WHERE kujdestar_id = ?)');
        params.push(user.id);
    }

    const [rows] = await pool.query(
        `SELECT l.professor_id, u.full_name AS professor_name,
            COUNT(*) AS total_hours,
            SUM(l.substitute_for IS NOT NULL) AS substitutions,
            SUM(l.review_status = 'ok') AS verified,
            SUM(l.review_status = 'error') AS flagged
       FROM lessons l
       JOIN professors u ON u.id = l.professor_id
      WHERE ${where.join(' AND ')}
      GROUP BY l.professor_id, u.full_name
      ORDER BY total_hours DESC, u.full_name`,
        params
    );
    return rows.map((r) => ({
        ...r,
        total_hours: Number(r.total_hours),
        substitutions: Number(r.substitutions),
        verified: Number(r.verified),
        flagged: Number(r.flagged),
    }));
}


// ---------------------------------------------------------------
//  Orët e mbajtura — pasqyra e administratës
// ---------------------------------------------------------------

/**
 * Kufijtë e periudhës së kërkuar.
 *
 *   'dita'  → një ditë e vetme
 *   'java'  → e hëna deri të premten e asaj jave (shkolla s'punon fundjavë)
 *   'muaji' → muaji i plotë
 *
 * Kthehen gjithnjë dy data të plota, që pyetja te baza të jetë e njëjtë
 * për të tria rastet — një kusht i vetëm `BETWEEN`, jo tri degë.
 */
function periodRange(period, value) {
    const iso = (d) => d.toISOString().slice(0, 10);

    if (period === 'muaji') {
        assertMonth(value);
        const [y, m] = value.split('-').map(Number);
        return {
            from: iso(new Date(Date.UTC(y, m - 1, 1))),
            to: iso(new Date(Date.UTC(y, m, 0))),
            label: value,
        };
    }

    const day = assertLessonDate(value);
    if (period === 'dita') return { from: day, to: day, label: day };

    if (period === 'java') {
        const d = new Date(`${day}T00:00:00Z`);
        // getUTCDay: 1 = e hënë. Data është ditë pune, sepse assertLessonDate
        // i refuzon fundjavat.
        const monday = new Date(d);
        monday.setUTCDate(d.getUTCDate() - (d.getUTCDay() - 1));
        const friday = new Date(monday);
        friday.setUTCDate(monday.getUTCDate() + 4);
        return { from: iso(monday), to: iso(friday), label: `${iso(monday)}…${iso(friday)}` };
    }

    throw httpError(400, 'Periudha duhet të jetë dita, java ose muaji.');
}

/**
 * Orët e mbajtura brenda periudhës, me përmbledhjen për çdo mësimdhënës.
 *
 * Të dyja vijnë nga e njëjta pyetje e filtruar: nëse lista dhe shifrat
 * do të nxirreshin veç e veç, një filtër i ndryshuar në njërën anë do
 * ta bënte përmbledhjen të mos i përgjigjej më listës që shihet.
 */
async function heldLessons(user, filters = {}) {
    if (!can(user, 'oret_raport')) {
        throw httpError(403, 'Nuk keni qasje në pasqyrën e orëve të mbajtura.');
    }

    const period = filters.period || 'muaji';
    const range = periodRange(period, filters.date);

    const where = ['l.lesson_date BETWEEN ? AND ?'];
    const params = [range.from, range.to];

    if (filters.professor_id) {
        // Zëvendësimet: ora i takon atij që e mbajti, ndaj filtrohet sipas
        // professor_id — kështu ora e zëvendësuar del te zëvendësuesi.
        where.push('l.professor_id = ?');
        params.push(Number(filters.professor_id));
    }
    if (filters.class_id) {
        where.push('l.class_id = ?');
        params.push(Number(filters.class_id));
    }
    if (filters.only_substitutions === 'true' || filters.only_substitutions === true) {
        where.push('l.substitute_for IS NOT NULL');
    }

    const clause = `WHERE ${where.join(' AND ')}`;

    const [rows] = await pool.query(
        `SELECT l.id, l.lesson_date, l.period, l.topic,
            l.review_status, l.review_comment,
            cs.name AS subject_name,
            c.id AS class_id, c.name AS class_name, c.study_year,
            cat.name AS category_name, cat.color AS category_color,
            p.id AS professor_id, p.full_name AS professor_name,
            m.full_name AS substitute_for_name,
            r.full_name AS reviewed_by_name
       FROM lessons l
       JOIN class_subjects cs ON cs.id = l.subject_id
       JOIN classes c ON c.id = l.class_id
       JOIN categories cat ON cat.id = c.category_id
       JOIN professors p ON p.id = l.professor_id
  LEFT JOIN professors m ON m.id = l.substitute_for
  LEFT JOIN users r ON r.id = l.reviewed_by
      ${clause}
      ORDER BY l.lesson_date, l.period, c.study_year, c.name`,
        params
    );

    const [summary] = await pool.query(
        `SELECT l.professor_id, p.full_name AS professor_name,
            COUNT(*) AS total_hours,
            SUM(l.substitute_for IS NOT NULL) AS substitutions,
            SUM(l.review_status = 'ok') AS verified,
            SUM(l.review_status = 'error') AS flagged,
            COUNT(DISTINCT l.class_id) AS classes
       FROM lessons l
       JOIN professors p ON p.id = l.professor_id
      ${clause}
      GROUP BY l.professor_id, p.full_name
      ORDER BY total_hours DESC, p.full_name`,
        params
    );

    return {
        period,
        from: range.from,
        to: range.to,
        lessons: rows.map((l) => ({
            ...l,
            lesson_date: toISODate(l.lesson_date),
            class_label: registerService.classLabelOf(l.study_year, l.class_name),
        })),
        summary: summary.map((r) => ({
            ...r,
            total_hours: Number(r.total_hours),
            substitutions: Number(r.substitutions),
            verified: Number(r.verified),
            flagged: Number(r.flagged),
            classes: Number(r.classes),
        })),
        total_hours: rows.length,
    };
}

/** Mesimdhenesit dhe paralelet — per filtrat e faqes. */
async function reportFilters(user) {
    if (!can(user, 'oret_raport')) {
        throw httpError(403, 'Nuk keni qasje në pasqyrën e orëve të mbajtura.');
    }
    const [professors] = await pool.query(
        'SELECT id, full_name FROM professors ORDER BY is_active DESC, full_name'
    );
    const classes = await listClasses(user);
    return { professors, classes };
}

module.exports = {
    MAX_PERIOD,
    listClasses,
    getMonth,
    createLesson,
    updateLesson,
    deleteLesson,
    reviewLesson,
    monthlyReport,
    heldLessons,
    reportFilters,
};