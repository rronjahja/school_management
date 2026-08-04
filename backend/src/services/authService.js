const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { httpError } = require('../middleware/errorHandler');

/**
 * Rolet e lejuara, nga me i gjeri te me i ngushti.
 *
 * 'kujdestar' per momentin ka te njejtat te drejta si 'staff': asnje
 * qasje financiare dhe asnje te drejte administrimi. Te drejtat e veta
 * shtohen kur te percaktohet cfare duhet te shohe kujdestari.
 */
const ROLES = ['admin', 'finance', 'kujdestar', 'staff'];
const {
  JWT_SECRET,
  TOKEN_TTL,
  BCRYPT_ROUNDS,
  MIN_PASSWORD_LENGTH,
  MAX_FAILED_ATTEMPTS,
  LOCK_MINUTES,
} = require('../config/auth');

// Hash i rreme: perdoret kur perdoruesi nuk ekziston, qe koha e pergjigjes
// te jete e njejte dhe te mos zbulohet cilat emra ekzistojne.
const DUMMY_HASH = bcrypt.hashSync('nuk-ekziston-ky-perdorues', BCRYPT_ROUNDS);

const PUBLIC_FIELDS = 'id, username, full_name, role, is_active, last_login_at, created_at';

function validatePassword(password) {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw httpError(400, `Fjalëkalimi duhet të ketë të paktën ${MIN_PASSWORD_LENGTH} karaktere.`);
  }
  if (!/[A-Za-zÇËçë]/.test(password) || !/[0-9]/.test(password)) {
    throw httpError(400, 'Fjalëkalimi duhet të përmbajë të paktën një shkronjë dhe një numër.');
  }
}

const hashPassword = (p) => bcrypt.hash(p, BCRYPT_ROUNDS);

function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

async function logAttempt(username, success, req) {
  try {
    await pool.query('INSERT INTO login_log SET ?', [{
      username: String(username || '').slice(0, 60),
      success: success ? 1 : 0,
      ip: (req.ip || '').slice(0, 60),
      user_agent: String(req.get('user-agent') || '').slice(0, 255),
    }]);
  } catch {
    /* regjistrimi i auditit nuk duhet ta prishe hyrjen */
  }
}

/** A ka ndonje perdorues ne sistem? (per faqen e hyrjes) */
async function hasUsers() {
  const [[r]] = await pool.query('SELECT COUNT(*) AS c FROM users WHERE is_active = 1');
  return r.c > 0;
}

/**
 * Verifikon kredencialet.
 * Mesazhi i gabimit eshte gjithmone i njejte — nuk zbulon nese emri ekziston.
 */
async function login(username, password, req) {
  const GENERIC = 'Emri i përdoruesit ose fjalëkalimi është i pasaktë.';

  const [rows] = await pool.query('SELECT * FROM users WHERE username = ? LIMIT 1', [username || '']);
  const user = rows[0];

  // Krahasojme gjithmone nje hash, edhe kur perdoruesi mungon (mbrojtje nga koha)
  const hash = user ? user.password_hash : DUMMY_HASH;
  const ok = await bcrypt.compare(String(password || ''), hash);

  if (!user || !user.is_active) {
    await logAttempt(username, false, req);
    throw httpError(401, GENERIC);
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    await logAttempt(username, false, req);
    const mins = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    throw httpError(423, `Llogaria është bllokuar përkohësisht. Provoni sërish pas ${mins} minutash.`);
  }

  if (!ok) {
    const attempts = user.failed_attempts + 1;
    const lock = attempts >= MAX_FAILED_ATTEMPTS;
    await pool.query(
      'UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?',
      [
        lock ? 0 : attempts,
        lock ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
        user.id,
      ]
    );
    await logAttempt(username, false, req);
    throw httpError(
      lock ? 423 : 401,
      lock
        ? `Llogaria u bllokua për ${LOCK_MINUTES} minuta pas shumë provave të dështuara.`
        : GENERIC
    );
  }

  await pool.query(
    'UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = ?',
    [user.id]
  );
  await logAttempt(username, true, req);

  return {
    token: signToken(user),
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
    },
  };
}

async function getUserById(id) {
  const [rows] = await pool.query(
    `SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ? AND is_active = 1 LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function changeOwnPassword(userId, currentPassword, newPassword) {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
  const user = rows[0];
  if (!user) throw httpError(404, 'Përdoruesi nuk u gjet.');

  const ok = await bcrypt.compare(String(currentPassword || ''), user.password_hash);
  if (!ok) throw httpError(401, 'Fjalëkalimi aktual është i pasaktë.');

  validatePassword(newPassword);
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [
    await hashPassword(newPassword),
    userId,
  ]);
}

// ----------------------------- menaxhimi i perdoruesve (vetem admin)

async function listUsers() {
  const [rows] = await pool.query(`SELECT ${PUBLIC_FIELDS} FROM users ORDER BY created_at`);
  return rows;
}

async function createUser({ username, password, full_name, role }) {
  const name = String(username || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,60}$/.test(name)) {
    throw httpError(400, 'Emri i përdoruesit: 3-60 karaktere, vetëm shkronja, numra, . _ -');
  }
  if (!String(full_name || '').trim()) throw httpError(400, 'Emri i plotë është i detyrueshëm.');
  if (!ROLES.includes(role)) throw httpError(400, 'Roli nuk është i vlefshëm.');
  validatePassword(password);

  const [[dup]] = await pool.query('SELECT COUNT(*) AS c FROM users WHERE username = ?', [name]);
  if (dup.c) throw httpError(409, 'Ky emër përdoruesi është i zënë.');

  const [res] = await pool.query('INSERT INTO users SET ?', [{
    username: name,
    password_hash: await hashPassword(password),
    full_name: String(full_name).trim(),
    role,
  }]);
  return getUserById(res.insertId);
}

async function updateUser(id, { full_name, role, is_active }, actingUserId) {
  const data = {};
  if (full_name !== undefined) data.full_name = String(full_name).trim();
  if (role !== undefined) {
    if (!ROLES.includes(role)) throw httpError(400, 'Roli nuk është i vlefshëm.');
    data.role = role;
  }
  if (is_active !== undefined) data.is_active = is_active ? 1 : 0;

  // Mos e lejo administratorin te c'aktivizoje ose te zbrese veten
  const losesAdmin = data.role !== undefined && data.role !== 'admin';
  if (Number(id) === Number(actingUserId) && (data.is_active === 0 || losesAdmin)) {
    throw httpError(400, 'Nuk mund të çaktivizoni ose të zbrisni llogarinë tuaj.');
  }

  // Duhet te mbetet te pakten nje administrator aktiv
  if (data.is_active === 0 || losesAdmin) {
    const [[r]] = await pool.query(
      "SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND is_active = 1 AND id <> ?",
      [id]
    );
    if (r.c === 0) throw httpError(400, 'Duhet të mbetet të paktën një administrator aktiv.');
  }

  if (!Object.keys(data).length) return getUserById(id);
  await pool.query('UPDATE users SET ? WHERE id = ?', [data, id]);
  return getUserById(id);
}

async function resetPassword(id, newPassword) {
  validatePassword(newPassword);
  const [res] = await pool.query(
    'UPDATE users SET password_hash = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?',
    [await hashPassword(newPassword), id]
  );
  if (!res.affectedRows) throw httpError(404, 'Përdoruesi nuk u gjet.');
}

module.exports = {
  ROLES,
  login,
  verifyToken,
  signToken,
  getUserById,
  hasUsers,
  changeOwnPassword,
  listUsers,
  createUser,
  updateUser,
  resetPassword,
  hashPassword,
  validatePassword,
};