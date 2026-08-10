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
  grade_review: 'Kontrolli i notave',
  lesson: 'Ora e mësimit',
  professor: 'Profesori',
  export: 'Eksporti',
  document: 'Dokumenti',
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
  download: 'u shkarkua',
};

/**
 * Leximet që regjistrohen.
 *
 * Shfletimi i ekraneve NUK regjistrohet — do ta mbyste ditarin dhe s'thotë
 * asgjë. Por nxjerrja e të dhënave jashtë sistemit është veprim: kush e
 * shkarkoi tabelën e plotë të pagesave, kujt i doli kontrata, kush e
 * printoi fletëpagesën. Këto lihen gjurmë sepse janë pikërisht ato që
 * pyeten më vonë.
 */
const READ_ROUTES = [
  [/^\/api\/export\/finance-excel$/, 'export', 'export'],
  [/^\/api\/students\/\d+\/(document|registration-doc)$/, 'document', 'download'],
  [/^\/api\/students\/\d+\/fletepagesa$/, 'document', 'download'],
  [/^\/api\/payments\/\d+\/fletepagesa$/, 'document', 'download'],
];

/** Shkrimet: rruga -> subjekti. Modelet e ngushta PARA atyre të gjera. */
const WRITE_ROUTES = [
  [/^\/api\/students\/\d+$/, 'student'],
  [/^\/api\/students$/, 'student'],
  // Ditari i klasës — modelet e veçanta PËRPARA atij të përgjithshëm /classes
  [/^\/api\/classes\/\d+\/grades/, 'grade'],
  [/^\/api\/grades/, 'grade'],
  [/^\/api\/classes\/\d+\/final-grade/, 'grade'],
  [/^\/api\/classes\/\d+\/subjects/, 'subject'],
  [/^\/api\/classes\/\d+\/meta/, 'register'],
  [/^\/api\/classes\/\d+\/order/, 'register'],
  [/^\/api\/classes\/\d+\/lessons/, 'lesson'],
  [/^\/api\/classes\/\d+\/reviews/, 'grade_review'],
  [/^\/api\/classes/, 'class'],
  [/^\/api\/subjects/, 'subject'],
  [/^\/api\/professors/, 'professor'],
  [/^\/api\/lessons/, 'lesson'],
  [/^\/api\/payments/, 'payment'],
  [/^\/api\/users/, 'user'],
  [/^\/api\/banks/, 'bank'],
  [/^\/api\/categories/, 'category'],
  [/^\/api\/settings/, 'settings'],
  [/^\/api\/promotion/, 'promotion'],
  [/^\/api\/import/, 'student'],
  [/^\/api\/auth/, 'auth'],
];

const WRITE_VERBS = { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' };

/** ID-ja e burimit është numri i PARË te rruga: /payments/12/fletepagesa -> 12 */
function resourceId(path) {
  const m = String(path).match(/\/(\d+)(?:\/|$)/);
  return m ? m[1] : null;
}

/** Rruga e kërkesës -> { entity, action, entity_id } ose null (pa regjistrim). */
function classify(method, path) {
  const p = String(path).split('?')[0];

  if (method === 'GET' || method === 'HEAD') {
    const read = READ_ROUTES.find(([re]) => re.test(p));
    if (!read) return null;
    return { entity: read[1], action: read[2], entity_id: resourceId(p) };
  }

  const verb = WRITE_VERBS[method];
  if (!verb) return null;

  const hit = WRITE_ROUTES.find(([re]) => re.test(p));
  if (!hit) return null;

  let action = verb;
  if (p.endsWith('/reset-password')) action = 'password-reset';
  else if (p.endsWith('/change-password')) action = 'password-change';
  else if (p.endsWith('/logout')) action = 'logout';
  else if (p.endsWith('/login')) action = 'login';
  else if (p.startsWith('/api/promotion/run')) action = 'run';
  else if (p.startsWith('/api/import')) action = 'import';

  return { entity: hit[1], action, entity_id: resourceId(p) };
}

/**
 * Përshkrim i shkurtër shqip, p.sh. «Nxënësi u krijua».
 *
 * Kur veprimi DËSHTOI, teksti e thotë që në fillim. Pa këtë, rreshti do
 * të lexohej «Nxënësi u fshi» edhe kur fshirja u refuzua — dhe ditari do
 * të dëshmonte diçka që s'ka ndodhur.
 */
function describe({ entity, action, summary, status_code: status }) {
  const base = summary || `${ENTITY_LABELS[entity] || entity} ${ACTION_LABELS[action] || action}`;
  if (status && status >= 400) return `Nuk u krye (${status}): ${base}`;
  return base;
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
async function list({
  search, username, entity, action, from, to, page, limit, only_failed,
} = {}) {
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
  // Vetem perpjekjet e deshtuara: hyrje te gabuara, veprime te ndaluara,
  // te dhena te pavlefshme. Kjo eshte pyetja e pare kur dicka «nuk punon».
  if (only_failed === 'true' || only_failed === true) {
    where.push('(status_code >= 400 OR action = ?)');
    params.push('login-failed');
  }

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
  const [[fails]] = await pool.query(
    "SELECT COUNT(*) AS n FROM activity_log WHERE status_code >= 400 OR action = 'login-failed'"
  );

  return {
    failed: Number(fails.n),
    usernames: users.map((r) => r.username),
    entities: entities.map((r) => ({ value: r.entity, label: ENTITY_LABELS[r.entity] || r.entity })),
    actions: actions.map((r) => ({ value: r.action, label: ACTION_LABELS[r.action] || r.action })),
  };
}

module.exports = {
  record, list, facets, classify, describe, ENTITY_LABELS, ACTION_LABELS,
};