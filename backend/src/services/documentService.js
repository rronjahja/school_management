const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { httpError } = require('../middleware/errorHandler');
const financeService = require('./financeService');
const { PLAN_CONFIG } = require('../config/finance');

// Te gjitha shabllonet Word qendrojne ketu (kontrata, vertetime, etj.)
const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'templates');

const formatDate = (d) => (d ? dayjs(d).format('DD.MM.YYYY') : '');
/** '2025/2026' -> '2025/26' */
const shortGen = (g) => {
  const m = String(g || '').match(/(\d{4})\s*\/\s*(\d{2,4})/);
  return m ? `${m[1]}/${m[2].slice(-2)}` : g || '';
};

const YEAR_LABELS = { 1: 'Viti I', 2: 'Viti II', 3: 'Viti III' };
const ROMAN_YEAR = { 1: 'X', 2: 'XI', 3: 'XII' };

/** Emri i plote i personit qe kontaktohet i pari (prind ose kujdestar). */
function primaryName(s) {
  const full = (a, b) => [a, b].filter(Boolean).join(' ').trim();
  const mother = full(s.mother_name, s.mother_last_name);
  const father = full(s.father_name, s.father_last_name);
  const guardian = full(s.guardian_name, s.guardian_last_name);

  if (s.primary_contact === 'guardian') return guardian || father || mother || '';
  const first = s.primary_contact === 'mother' ? mother : father;
  return first || mother || father || '';
}

/** Nje fushe e prindit qe kontaktohet i pari, me rezerve tjetrin. */
function primaryField(s, suffix) {
  if (s.primary_contact === 'guardian') {
    return s[`guardian_${suffix}`] || s[`father_${suffix}`] || s[`mother_${suffix}`] || '';
  }
  const mine = s.primary_contact === 'mother' ? s[`mother_${suffix}`] : s[`father_${suffix}`];
  const other = s.primary_contact === 'mother' ? s[`father_${suffix}`] : s[`mother_${suffix}`];
  return mine || other || '';
}

/** Telefoni i prindit qe kontaktohet i pari (me rezerve tjetrin). */
function primaryPhone(s) {
  return primaryField(s, 'phone');
}

const formatMoney = (n) =>
  Number(n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Lista e shablloneve te disponueshme (skedaret .docx ne templates/). */
function listTemplates() {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  return fs
    .readdirSync(TEMPLATES_DIR)
    .filter((f) => f.toLowerCase().endsWith('.docx') && !f.startsWith('~$'))
    .map((f) => ({
      file: f,
      label: path.basename(f, path.extname(f)).replace(/[_-]+/g, ' '),
    }));
}

/** Te dhenat qe mbushin cdo etikete {tag} te shablloneve. */
function buildTemplateData(student) {
  const f = student.finance;

  let zbritja = '—';
  let zbritje_perqindje = '';
  let zbritje_fikse = '';
  if (student.discount_type === 'percent' && Number(student.discount_value)) {
    zbritje_perqindje = `${Number(student.discount_value)}`;
    zbritja = `${Number(student.discount_value)}%`;
  } else if (student.discount_type === 'amount' && Number(student.discount_value)) {
    zbritje_fikse = formatMoney(student.discount_value);
    zbritja = `${zbritje_fikse} €`;
  }

  return {
    // Nxenesi
    emri: student.first_name,
    mbiemri: student.last_name,
    datelindja: formatDate(student.birthday),
    qyteti: student.city,
    komuna: student.city,   // alias i {qyteti} — perdorni cilindo ne shabllon
    adresa: student.address,
    telefoni: student.phone,
    email: student.email || '',
    shtetesia: student.citizenship || '',
    kombesia: student.nationality || '',

    // Prinderit / kujdestari
    emri_nenes: student.mother_name,
    mbiemri_nenes: student.mother_last_name || '',
    data_lindjes_nenes: formatDate(student.mother_birthday),
    emri_babait: student.father_name,
    mbiemri_babait: student.father_last_name || '',
    // Numri personal: {numri_personal} i takon kontaktit te pare
    numri_personal_nenes: student.mother_personal_id || '',
    numri_personal_babait: student.father_personal_id || '',
    numri_personal: primaryField(student, 'personal_id'),
    data_lindjes_babait: formatDate(student.father_birthday),
    // Telefonat e prinderve; {telefoni_prindit} i takon kontaktit te pare
    telefoni_nenes: student.mother_phone || '',
    telefoni_babait: student.father_phone || '',
    telefoni_prindit: primaryPhone(student),
    kontakti_i_pare: primaryName(student),
    // Kujdestari ligjor (bosh kur nxenesi ka prinder te regjistruar)
    emri_kujdestarit: student.guardian_name || '',
    mbiemri_kujdestarit: student.guardian_last_name || '',
    telefoni_kujdestarit: student.guardian_phone || '',
    data_lindjes_kujdestarit: formatDate(student.guardian_birthday),
    numri_personal_kujdestarit: student.guardian_personal_id || '',

    // Shkollimi
    drejtimi: student.category_name,

    // Viti shkollor — i njejti informacion, tri forma per t'u zgjedhur ne shabllon
    gjenerata: student.generation,                    // 2025/2026
    gjenerata_shkurt: shortGen(student.generation),   // 2025/26
    viti_shkollor: student.generation,                // alias i {gjenerata}
    viti_studimit: YEAR_LABELS[student.study_year] || '', // Viti I / II / III
    // Paralelja: ne baze ruhet vetem numri, prefiksi vjen nga viti i studimit
    klasa: student.class_name
      ? `${ROMAN_YEAR[student.study_year] || ''}${ROMAN_YEAR[student.study_year] ? '/' : ''}${student.class_name}`
      : '',
    paralelja: student.class_name || '',   // vetem numri, p.sh. 1
    nr_kontrates: student.contract_number || '',
    data_regjistrimit: formatDate(student.enrollment_date),
    data_sotme: dayjs().format('DD.MM.YYYY'),

    // Financat
    cmimi: formatMoney(student.yearly_quota),
    kuota_vjetore: formatMoney(student.yearly_quota),
    totali: formatMoney(f.net_quota),
    kuota_neto: formatMoney(f.net_quota),
    zbritja,
    zbritje_perqindje,
    zbritje_fikse,
    plani_pageses: (PLAN_CONFIG[student.payment_plan] || {}).label || student.payment_plan,

    // Pasqyra e kesteve — perdoret ne bllokun {#keste}...{/keste}.
    // Kontrata mbulon vitin e vet shkollor, prandaj rreshti
    // "Borxhi i vitit te kaluar" nuk perfshihet ne aneks.
    keste: f.installments
      .filter((i) => !i.is_carryover)
      .map((i) => ({
        nr: `${i.seq}.`,
        afati: formatDate(i.due_date),
        shuma: formatMoney(i.amount),
      })),
  };
}

/** Gjeneron nje dokument Word nga shablloni i dhene per studentin. */
async function generateDocument(studentId, templateFile) {
  const templates = listTemplates();
  if (!templates.length) {
    throw httpError(
      404,
      'Asnjë shabllon nuk u gjet. Vendosni skedarë .docx në dosjen backend/templates.'
    );
  }

  const chosen = templateFile
    ? templates.find((t) => t.file === templateFile)
    : templates[0];
  if (!chosen) throw httpError(404, 'Shablloni i kërkuar nuk u gjet.');

  const student = await financeService.getStudentDetail(studentId);

  const zip = new PizZip(fs.readFileSync(path.join(TEMPLATES_DIR, chosen.file), 'binary'));
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  doc.render(buildTemplateData(student));

  const base = path.basename(chosen.file, path.extname(chosen.file));
  return {
    buffer: doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }),
    filename: `${base}_${student.first_name}_${student.last_name}.docx`,
  };
}

module.exports = { listTemplates, generateDocument };