const pool = require('../config/db');
const { httpError } = require('../middleware/errorHandler');
const { can, isManager, isReviewer } = require('../config/roles');
const registerService = require('./registerService');

/**
 * Ditari i orëve të mësimit — libri «Orët e mësimit sipas fushave dhe
 * lëndëve mësimore». Çdo ditë pune ka deri në 7 orë; profesori shënon
 * lëndën dhe temën e orës që mbajti.
 *
 * RREGULLAT E SHKRIMIT (të gjitha zbatohen KËTU, në server):
 *   · profesori shkruan vetëm orë të VETAT (professor_id = ai vetë) dhe
 *     ndryshon vetëm ato që stafi s'i ka pranuar ende
 *   · stafi, menaxheri dhe administratori shkruajnë e ndryshojnë çdo orë
 *     — përfshirë zëvendësimet
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

async function assertProfessor(userId, label) {
    const [[u]] = await pool.query(
        "SELECT id, full_name FROM users WHERE id = ? AND role = 'profesor' AND is_active = 1",
        [userId]
    );
    if (!u) throw httpError(400, `${label} duhet të jetë përdorues aktiv me rolin «Profesor».`);
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
    if (user.role === 'profesor' && lesson.professor_id === user.id) {
        if (lesson.review_status === 'ok') {
            throw httpError(403,
                'Kjo orë është pranuar nga kontrolli dhe nuk ndryshohet më — drejtojuni stafit.');
        }
        return;
    }
    throw httpError(403, 'Ju ndryshoni vetëm orët tuaja.');
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
       JOIN users p ON p.id = l.professor_id
  LEFT JOIN users m ON m.id = l.substitute_for
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
        "SELECT id, full_name FROM users WHERE role = 'profesor' AND is_active = 1 ORDER BY full_name"
    );

    return {
        class: cls,
        month,
        lessons: lessons.map((l) => ({ ...l, lesson_date: toISODate(l.lesson_date) })),
        subjects,
        professors,
        can_admin: canAdminLessons(user),
        can_review: isReviewer(user),
        is_professor: user.role === 'profesor',
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

    // Kush e mbajti orën. Profesori vetëm veten — një profesor nuk shkruan
    // orë në emër të një tjetri; atë e bën stafi kur regjistron zëvendësim.
    let professorId;
    if (user.role === 'profesor') {
        professorId = user.id;
        if (data.professor_id && Number(data.professor_id) !== user.id) {
            throw httpError(403, 'Ju shënoni vetëm orët tuaja. Zëvendësimet i regjistron stafi.');
        }
    } else {
        professorId = Number(data.professor_id);
        await assertProfessor(professorId, 'Mbajtësi i orës');
    }

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
        throw httpError(403, 'Orët i shënojnë profesorët dhe stafi.');
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
                `Ora ${v.period} e datës ${v.lesson_date.split('-').reverse().join('.')} `
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
       JOIN users p ON p.id = l.professor_id
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
 * Profesori sheh vetëm rreshtin e vet; të tjerët gjithë tabelën.
 */
async function monthlyReport(user, month, classId = null) {
    if (!can(user, 'mesimi')) throw httpError(403, 'Nuk keni qasje në raportin e orëve.');
    assertMonth(month);

    const where = ["DATE_FORMAT(l.lesson_date, '%Y-%m') = ?"];
    const params = [month];
    if (classId) { where.push('l.class_id = ?'); params.push(Number(classId)); }
    if (user.role === 'profesor') { where.push('l.professor_id = ?'); params.push(user.id); }
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
       JOIN users u ON u.id = l.professor_id
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

module.exports = {
    MAX_PERIOD,
    listClasses,
    getMonth,
    createLesson,
    updateLesson,
    deleteLesson,
    reviewLesson,
    monthlyReport,
};