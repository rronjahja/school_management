const pool = require('../config/db');
const { httpError } = require('../middleware/errorHandler');

// ═══════════════════════════════════════════════════════════════
//  Bankat
// ═══════════════════════════════════════════════════════════════

const listBanks = async () => (await pool.query('SELECT * FROM banks ORDER BY name'))[0];

function cleanBank(body) {
  const name = String(body.name || '').trim();
  if (name.length < 2 || name.length > 100) {
    throw httpError(400, 'Emri i bankës duhet të ketë 2-100 karaktere.');
  }

  // Numri i llogarise eshte opsional; ruhet ashtu si shkruhet (me hapesira)
  const account = String(body.account_number || '').trim();
  if (account && !/^[0-9 -]{6,40}$/.test(account)) {
    throw httpError(400, 'Numri i llogarisë lejon vetëm shifra, hapësira dhe vizë (6-40 karaktere).');
  }

  return { name, account_number: account || null };
}

async function createBank(body) {
  const data = cleanBank(body);

  const [[dup]] = await pool.query('SELECT COUNT(*) AS c FROM banks WHERE name = ?', [data.name]);
  if (dup.c) throw httpError(409, 'Kjo bankë ekziston tashmë.');

  const [res] = await pool.query('INSERT INTO banks SET ?', [data]);
  const [[row]] = await pool.query('SELECT * FROM banks WHERE id = ?', [res.insertId]);
  return row;
}

async function updateBank(id, body) {
  const data = cleanBank(body);

  const [[dup]] = await pool.query(
    'SELECT COUNT(*) AS c FROM banks WHERE name = ? AND id <> ?', [data.name, id]
  );
  if (dup.c) throw httpError(409, 'Një bankë tjetër e ka këtë emër.');

  const [res] = await pool.query('UPDATE banks SET ? WHERE id = ?', [data, id]);
  if (!res.affectedRows) throw httpError(404, 'Banka nuk u gjet.');

  const [[row]] = await pool.query('SELECT * FROM banks WHERE id = ?', [id]);
  return row;
}

async function deleteBank(id) {
  // Pagesat e regjistruara nuk duhet te mbeten pa banke
  const [[used]] = await pool.query(
    'SELECT COUNT(*) AS c FROM payments WHERE bank_id = ?', [id]
  );
  if (used.c) {
    throw httpError(
      409,
      `Kjo bankë nuk mund të fshihet sepse përdoret te ${used.c} pagesa. ` +
        'Mund ta riemërtoni në vend që ta fshini.'
    );
  }

  const [res] = await pool.query('DELETE FROM banks WHERE id = ?', [id]);
  if (!res.affectedRows) throw httpError(404, 'Banka nuk u gjet.');
}

// ═══════════════════════════════════════════════════════════════
//  Drejtimet
// ═══════════════════════════════════════════════════════════════

const listCategories = async () =>
  (await pool.query('SELECT * FROM categories ORDER BY name'))[0];

function cleanCategory(body) {
  const name = String(body.name || '').trim();
  if (name.length < 2 || name.length > 100) {
    throw httpError(400, 'Emri i drejtimit duhet të ketë 2-100 karaktere.');
  }

  // Kodi hyn te numri i kontrates (p.sh. 01/2025/TD)
  const code = String(body.code || '').trim().toUpperCase();
  if (!/^[A-ZËÇ]{1,6}$/.test(code)) {
    throw httpError(400, 'Kodi duhet të jetë 1-6 shkronja, p.sh. TD ose AI.');
  }

  const color = String(body.color || '').trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw httpError(400, 'Ngjyra duhet të jetë në formatin #1257A6.');
  }

  // Kuota vjetore e paracaktuar: opsionale, por nese jepet duhet numer i vlefshem
  let quota = null;
  const raw = body.default_quota;
  if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
    if (!Number.isFinite(Number(raw))) {
      throw httpError(400, 'Kuota vjetore duhet të jetë numër.');
    }
    quota = Math.round(Number(raw) * 100) / 100;
    if (quota < 0) throw httpError(400, 'Kuota vjetore nuk mund të jetë negative.');
    if (quota > 100000) throw httpError(400, 'Kuota vjetore duket e pasaktë.');
  }

  return { name, code, color, default_quota: quota };
}

async function createCategory(body) {
  const data = cleanCategory(body);

  const [[dup]] = await pool.query(
    'SELECT COUNT(*) AS c FROM categories WHERE name = ? OR code = ?', [data.name, data.code]
  );
  if (dup.c) throw httpError(409, 'Ekziston një drejtim me këtë emër ose kod.');

  const [res] = await pool.query('INSERT INTO categories SET ?', [data]);
  const [[row]] = await pool.query('SELECT * FROM categories WHERE id = ?', [res.insertId]);
  return row;
}

async function updateCategory(id, body) {
  const data = cleanCategory(body);

  const [[dup]] = await pool.query(
    'SELECT COUNT(*) AS c FROM categories WHERE (name = ? OR code = ?) AND id <> ?',
    [data.name, data.code, id]
  );
  if (dup.c) throw httpError(409, 'Një drejtim tjetër e ka këtë emër ose kod.');

  // Ndryshimi i kodit nuk prek numrat e kontratave te leshuara — ato mbeten
  // ashtu si jane. Kodi i ri perdoret vetem per kontratat e reja.
  const [res] = await pool.query('UPDATE categories SET ? WHERE id = ?', [data, id]);
  if (!res.affectedRows) throw httpError(404, 'Drejtimi nuk u gjet.');

  const [[row]] = await pool.query('SELECT * FROM categories WHERE id = ?', [id]);
  return row;
}

async function deleteCategory(id) {
  const [[used]] = await pool.query(
    'SELECT COUNT(*) AS c FROM students WHERE category_id = ?', [id]
  );
  if (used.c) {
    throw httpError(
      409,
      `Ky drejtim nuk mund të fshihet sepse ka ${used.c} nxënës të regjistruar. ` +
        'Mund ta riemërtoni në vend që ta fshini.'
    );
  }

  const [res] = await pool.query('DELETE FROM categories WHERE id = ?', [id]);
  if (!res.affectedRows) throw httpError(404, 'Drejtimi nuk u gjet.');
}

// ═══════════════════════════════════════════════════════════════
//  Mesazhi i rikujteses (shabllon i ndryshueshem nga Cilesimet)
// ═══════════════════════════════════════════════════════════════

const REMINDER_TEMPLATE_KEY = 'reminder_template';

// Parazgjedhja riprodhon mesazhin e deritanishem, me mbajtes vendi.
// {pershendetja} dhe {te_nxenesit} lakohen sipas gjinise automatikisht.
const DEFAULT_REMINDER_TEMPLATE = [
  'Përshëndetje {pershendetja} {emri_kontaktit},',
  '',
  'Ky është një rikujtesë nga {shkolla} për obligimet financiare {te_nxenesit} ' +
    '{emri_nxenesit}, drejtimi {drejtimi}{viti_fraza}{klasa_fraza}.',
  '',
  '{detyrimet}',
  '',
  '{llogarite_bankare}',
  '',
  'Nëse pagesa është kryer tashmë, ju lutemi na dërgoni konfirmimin dhe ' +
    'konsiderojeni këtë mesazh të pavlefshëm.',
  '',
  'Faleminderit për bashkëpunimin,',
  '{shkolla}',
  '{telefoni_shkolles}',
  'Datë: {data}',
].join('\n');

async function getReminderTemplate() {
  const [[row]] = await pool.query(
    'SELECT value FROM app_settings WHERE setting_key = ?', [REMINDER_TEMPLATE_KEY]
  );
  return {
    template: row ? row.value : DEFAULT_REMINDER_TEMPLATE,
    is_default: !row,
    default_template: DEFAULT_REMINDER_TEMPLATE,
  };
}

async function setReminderTemplate(raw) {
  const value = String(raw ?? '');

  // Tekst bosh = rikthim ne parazgjedhje
  if (value.trim() === '') {
    await pool.query('DELETE FROM app_settings WHERE setting_key = ?', [REMINDER_TEMPLATE_KEY]);
    return getReminderTemplate();
  }

  if (value.length > 5000) {
    throw httpError(400, 'Mesazhi është shumë i gjatë (deri 5000 karaktere).');
  }

  await pool.query(
    'INSERT INTO app_settings (setting_key, value) VALUES (?, ?) ' +
      'ON DUPLICATE KEY UPDATE value = VALUES(value)',
    [REMINDER_TEMPLATE_KEY, value]
  );
  return getReminderTemplate();
}

module.exports = {
  listBanks, createBank, updateBank, deleteBank,
  listCategories, createCategory, updateCategory, deleteCategory,
  getReminderTemplate, setReminderTemplate,
};