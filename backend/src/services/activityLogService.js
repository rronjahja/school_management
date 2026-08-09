const pool = require('../config/db');

/**
 * Ditari i veprimeve — kush, çfarë, mbi çfarë dhe kur.
 *
 * PSE JO TRIGGER-A NË BAZË: një trigger MySQL e sheh vetëm rreshtin që
 * ndryshoi. Nuk e di se CILI përdorues i aplikacionit e nisi veprimin —
 * të gjitha lidhjet vijnë nga i njëjti përdorues i bazës. Emri, roli,
 * IP-ja dhe rruga e kërkesës dihen vetëm këtu, prandaj shkruhen këtu.
 *
 * Shkrimi nuk e bllokon kurrë veprimin: nëse ditari dështon, veprimi i
 * përdoruesit ka përfunduar tashmë me sukses dhe s'ka pse të rrëzohet.
 */

// ---------------------------------------------------------------
//  Fjalori: nga kodi te teksti shqip
// ---------------------------------------------------------------

const ENTITY_LABELS = {
  student: 'Nxënësi',
  payment: 'Pagesa',
  user: 'Përdoruesi',
  bank: 'Banka',
  category: 'Drejtimi',
  settings: 'Cilësimet',
  promotion: 'Kalimi i vitit',
  auth: 'Llogaria',
  class: 'Paralelja',
  subject: 'Lënda',
  grade: 'Nota',
  register: 'Ditari i klasës',
  grade_request: 'Kërkesa për notë',
  grade_review: 'Kontrolli i notave',
  lesson: 'Ora e mësimit',
  professor: 'Profesori',
};

const ACTION_LABELS = {
  create: 'u krijua',
  update: 'u përditësua',
  delete: 'u fshi',
  login: 'hyri në sistem',
  logout: 'doli nga sistemi',
  'login-failed': 'dështoi në hyrje',
  'password-change': 'ndryshoi fjalëkalimin',
  'password-reset': 'rivendosi fjalëkalimin',
  run: 'u ekzekutua',
  import: 'u importua',
  export: 'u eksportua',
};

/** Rruga e kërkesës -> { entity, action } */
function classify(method, path) {
  const p = String(path).split('?')[0];
  const seg = p.split('/').filter(Boolean);      // ['api','students','7']

  const verb = { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' }[method];
  if (!verb) return null;                        // GET/HEAD nuk ndryshojnë asgjë

  const map = [
    [/^\/api\/students\/\d+$/, 'student'],
    [/^\/api\/students$/, 'student'],
    // Ditari i klasës — modelet e veçanta PËRPARA atij të përgjithshëm /classes
    [/^\/api\/classes\/\d+\/grades/, 'grade'],
    [/^\/api\/grades/, 'grade'],
    [/^\/api\/classes\/\d+\/final-grade/, 'grade'],
    [/^\/api\/classes\/\d+\/subjects/, 'subject'],
    [/^\/api\/subjects/, 'subject'],
    [/^\/api\/classes\/\d+\/meta/, 'register'],
    [/^\/api\/classes\/\d+\/order/, 'register'],
    [/^\/api\/professors/, 'professor'],
    [/^\/api\/subjects/, 'subject'],
    [/^\/api\/classes\/\d+\/lessons/, 'lesson'],
    [/^\/api\/lessons/, 'lesson'],
    [/^\/api\/classes\/\d+\/reviews/, 'grade_review'],
    [/^\/api\/grade-issues/, 'grade_review'],
    [/^\/api\/classes\/\d+\/edit-requests/, 'grade_request'],
    [/^\/api\/edit-requests/, 'grade_request'],
    [/^\/api\/classes/, 'class'],
    [/^\/api\/payments/, 'payment'],
    [/^\/api\/users/, 'user'],
    [/^\/api\/banks/, 'bank'],
    [/^\/api\/categories/, 'category'],
    [/^\/api\/settings/, 'settings'],
    [/^\/api\/promotion/, 'promotion'],
    [/^\/api\/import/, 'student'],
    [/^\/api\/auth/, 'auth'],
  ];
  const hit = map.find(([re]) => re.test(p));
  if (!hit) return null;

  const entity = hit[1];
  let action = verb;

  // rastet e veçanta që s'janë thjesht create/update/delete
  if (p.endsWith('/reset-password')) action = 'password-reset';
  else if (p.endsWith('/change-password')) action = 'password-change';
  else if (p.endsWith('/logout')) action = 'logout';
  else if (p.endsWith('/login')) action = 'login';
  else if (p.startsWith('/api/promotion/run')) action = 'run';
  else if (p.startsWith('/api/import')) action = 'import';

  const id = seg.find((x, i) => i > 1 && /^\d+$/.test(x)) || null;
  return { entity, action, entity_id: id };
}

/** Përshkrim i shkurtër shqip, p.sh. «Nxënësi u krijua». */
function describe({ entity, action, summary }) {
  if (summary) return summary;
  const e = ENTITY_LABELS[entity] || entity;
  const a = ACTION_LABELS[action] || action;
  return `${e} ${a}`;
}

// ---------------------------------------------------------------
//  Shkrimi
// ---------------------------------------------------------------

/**
 * @param {object} entry {user, action, entity, entity_id, summary, details,
 *                        method, path, status_code, ip}
 */
async function record(entry) {
  const u = entry.user || {};
  try {
    await pool.query('INSERT INTO activity_log SET ?', [{
      user_id: u.id || null,
      username: u.username || entry.username || 'sistemi',
      full_name: u.full_name || null,
      role: u.role || null,
      action: String(entry.action).slice(0, 40),
      entity: String(entry.entity).slice(0, 30),
      entity_id: entry.entity_id ? String(entry.entity_id).slice(0, 40) : null,
      summary: describe(entry).slice(0, 255),
      details: entry.details ? JSON.stringify(entry.details).slice(0, 65000) : null,
      method: entry.method || null,
      path: entry.path ? String(entry.path).slice(0, 255) : null,
      status_code: entry.status_code || null,
      ip: entry.ip ? String(entry.ip).slice(0, 60) : null,
    }]);
  } catch (err) {
    // Ditari s'duhet ta rrezoje kurre veprimin qe sapo perfundoi me sukses
    console.error('[ditari] shkrimi dështoi:', err.message);
  }
}

// ---------------------------------------------------------------
//  Leximi (vetëm administratorët)
// ---------------------------------------------------------------

/**
 * Kërkim me filtra. `search` shikon te personi, përshkrimi dhe rruga —
 * kështu një emër, një fjalë si "fshi" ose një ID gjenden njësoj.
 */
async function list({ search, username, entity, action, from, to, page, limit } = {}) {
  const where = [];
  const params = [];

  if (search) {
    const like = `%${String(search).trim()}%`;
    where.push(`(username LIKE ? OR full_name LIKE ? OR summary LIKE ?
                 OR path LIKE ? OR entity_id LIKE ?)`);
    params.push(like, like, like, like, like);
  }
  if (username) { where.push('username = ?'); params.push(username); }
  if (entity) { where.push('entity = ?'); params.push(entity); }
  if (action) { where.push('action = ?'); params.push(action); }
  if (from) { where.push('created_at >= ?'); params.push(`${from} 00:00:00`); }
  if (to) { where.push('created_at <= ?'); params.push(`${to} 23:59:59`); }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const per = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const at = Math.max(Number(page) || 1, 1);
  const offset = (at - 1) * per;

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM activity_log ${clause}`, params
  );
  const [rows] = await pool.query(
    `SELECT * FROM activity_log ${clause} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, per, offset]
  );

  return { rows, total, page: at, limit: per, pages: Math.ceil(total / per) || 1 };
}

/** Vlerat e ndryshme, për të mbushur filtrat te ndërfaqja. */
async function facets() {
  const [users] = await pool.query(
    'SELECT DISTINCT username FROM activity_log ORDER BY username'
  );
  const [entities] = await pool.query(
    'SELECT DISTINCT entity FROM activity_log ORDER BY entity'
  );
  const [actions] = await pool.query(
    'SELECT DISTINCT action FROM activity_log ORDER BY action'
  );
  return {
    usernames: users.map((r) => r.username),
    entities: entities.map((r) => ({ value: r.entity, label: ENTITY_LABELS[r.entity] || r.entity })),
    actions: actions.map((r) => ({ value: r.action, label: ACTION_LABELS[r.action] || r.action })),
  };
}

module.exports = {
  record, list, facets, classify, describe, ENTITY_LABELS, ACTION_LABELS,
};