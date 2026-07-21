const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { httpError } = require('../middleware/errorHandler');
const financeService = require('./financeService');
const pool = require('../config/db');
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
// Fletepagesa gjenerohet nga butoni i vet te faqja e nxenesit, prandaj
// nuk duhet te dale mes shablloneve te kontratave.
const RESERVED_TEMPLATES = ['fletepagesa.docx'];

function listTemplates() {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  return fs
    .readdirSync(TEMPLATES_DIR)
    .filter((f) => f.toLowerCase().endsWith('.docx') && !f.startsWith('~$'))
    .filter((f) => !RESERVED_TEMPLATES.includes(f.toLowerCase()))
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
    emaili_nenes: student.mother_email || '',
    emaili_babait: student.father_email || '',
    emaili_kujdestarit: student.guardian_email || '',
    emaili_prindit: primaryField(student, 'email'),
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
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    // Etiketat qe mungojne ne te dhena mbeten BOSH ne dokument.
    // Pa kete, docxtemplater shkruan fjalen "undefined" ne vend te tyre.
    nullGetter: () => '',
  });
  doc.render(buildTemplateData(student));

  const base = path.basename(chosen.file, path.extname(chosen.file));
  return {
    buffer: doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }),
    filename: `${base}_${student.first_name}_${student.last_name}.docx`,
  };
}


// ═══════════════════════════════════════════════════════════════
//  Fletëpagesa — fleta bankare me dy gjysma (klienti + arkivi)
// ═══════════════════════════════════════════════════════════════

/**
 * Cilat këste i mbuloi NJË pagesë e caktuar? Pagesat derdhen mbi këstet
 * në rendin kohor (FIFO) — njësoj si llogaritja e bilancit — dhe mbahet
 * shënim cilat këste preku pagesa e kërkuar.
 */
function installmentsCoveredBy(paymentId, installments, payments, settled) {
  const slots = installments
    .map((i) => ({
      seq: i.is_carryover ? 0 : i.seq,
      carry: Boolean(i.is_carryover),
      amount: Number(i.amount),
      paid: 0,
    }))
    .sort((a, b) => a.seq - b.seq);

  const ordered = [...payments].sort(
    (a, b) => String(a.payment_date).localeCompare(String(b.payment_date)) || a.id - b.id
  );

  let burn = Math.max(Number(settled) || 0, 0);
  let idx = 0;
  const covered = [];

  for (const p of ordered) {
    let left = Number(p.amount);
    if (burn > 0) {
      const b = Math.min(burn, left);
      burn -= b; left -= b;
    }
    while (left > 0.004 && idx < slots.length) {
      const sl = slots[idx];
      const room = sl.amount - sl.paid;
      if (room <= 0.004) { idx += 1; continue; }
      const take = Math.min(room, left);
      sl.paid = Math.round((sl.paid + take) * 100) / 100;
      left = Math.round((left - take) * 100) / 100;
      if (p.id === paymentId) covered.push(sl);
    }
  }
  return covered;
}

/** ['Kësti 1','Kësti 2','Kësti 3'] -> "Kësti 1, 2 dhe 3" (me borxhin veç). */
function describeSlots(slots) {
  const parts = [];
  if (slots.some((s) => s.carry)) parts.push('Borxhi i vitit të kaluar');
  const seqs = slots.filter((s) => !s.carry).map((s) => s.seq);
  if (seqs.length === 1) parts.push(`Kësti ${seqs[0]}`);
  else if (seqs.length === 2) parts.push(`Kësti ${seqs[0]} dhe ${seqs[1]}`);
  else if (seqs.length > 2) {
    parts.push(`Kësti ${seqs.slice(0, -1).join(', ')} dhe ${seqs[seqs.length - 1]}`);
  }
  return parts.join(' dhe ');
}

/** Mbush shabllonin Fletepagesa.docx për një nxënës + përshkrim + shumë. */
function buildFletepagesa(student, description, amount) {
  const f = student.finance || {};
  const file = path.join(TEMPLATES_DIR, 'Fletepagesa.docx');
  if (!fs.existsSync(file)) {
    throw httpError(500, 'Shablloni Fletepagesa.docx mungon në templates/.');
  }
  const zip = new PizZip(fs.readFileSync(file, 'binary'));
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  });
  doc.render({
    emri_nxenesit: student.first_name,
    mbiemri_nxenesit: student.last_name,
    // "(emri i prindit)" — babai, ose kush ka emer i pari
    emri_babait:
      student.father_name || student.mother_name || student.guardian_name || '',
    nr_kontrates: student.contract_number || '',
    data_sotme: dayjs().format('DD.MM.YYYY'),
    pershkrimi_pageses: description,
    shuma: formatMoney(amount),
    // Gjendja financiare — total_due i perfshin edhe kestet e bartura,
    // keshtu qe Totali - Paguar = Mbetur del gjithmone i sakte
    totali: formatMoney(f.total_due),
    paguar: formatMoney(f.total_paid),
    mbetur: formatMoney(f.balance),
  });
  return {
    buffer: doc.getZip().generate({ type: 'nodebuffer' }),
    filename: `Fletepagesa_${student.first_name}_${student.last_name}.docx`,
  };
}

/** Fletëpagesa e NJË pagese të bërë (nga butoni te modali i pagesës). */
async function paymentSlip(paymentId) {
  const [[payment]] = await pool.query('SELECT * FROM payments WHERE id = ?', [paymentId]);
  if (!payment) throw httpError(404, 'Pagesa nuk u gjet.');

  const student = await financeService.getStudentDetail(payment.student_id);
  const covered = installmentsCoveredBy(
    payment.id,
    student.finance.installments,
    student.payments,
    student.settled_paid
  );
  const what = describeSlots(covered) || 'Pagesë shkollimi';
  const auto =
    `${what} — ${student.category_name}, viti shkollor ${student.generation}`;

  // Shenimi i shkruar nga perdoruesi ka perparesi: te modali ai mbushet
  // vetvetiu me pikerisht kete tekst, keshtu qe nese eshte ndryshuar, do
  // te thote qe eshte ndryshuar me qellim dhe fletepagesa duhet ta pasqyroje.
  const description = (payment.note && payment.note.trim()) || auto;

  return buildFletepagesa(student, description, payment.amount);
}

/** Fletëpagesa e detyrimeve të pashlyera (nga rikujtesa). */
/**
 * Fletepagesa per kestet e PAZGJEDHURA nga perdoruesi, ose — kur nuk
 * zgjidhet asnje — per detyrimet e vonuara/afer afatit.
 *
 * @param {number[]|null} seqs numrat e kesteve (0 = borxhi i bartur)
 */
async function reminderSlip(studentId, seqs = null) {
  const student = await financeService.getStudentDetail(studentId);
  const insts = student.finance.installments;

  const remainingOf = (i) => Number(i.amount) - Number(i.paid || 0);

  if (Array.isArray(seqs) && seqs.length) {
    const wanted = new Set(seqs.map(Number));
    const picked = insts.filter(
      (i) => wanted.has(i.is_carryover ? 0 : Number(i.seq)) && remainingOf(i) > 0.004
    );
    if (!picked.length) {
      throw httpError(400, 'Këstet e zgjedhura janë të shlyera ose nuk ekzistojnë.');
    }
    const sum = picked.reduce((a, i) => a + remainingOf(i), 0);
    const what = describeSlots(
      picked.map((i) => ({ seq: i.is_carryover ? 0 : i.seq, carry: Boolean(i.is_carryover) }))
    );
    return buildFletepagesa(
      student,
      `${what} — ${student.category_name}, viti shkollor ${student.generation}`,
      Math.round(sum * 100) / 100
    );
  }

  const overdue = insts.filter((i) => i.status === 'overdue');
  const soon = insts.filter((i) => i.status === 'due-soon');
  const targets = overdue.length ? overdue : soon;

  const remaining = (i) => Number(i.amount) - Number(i.paid || 0);
  const amount = targets.length
    ? targets.reduce((a, i) => a + remaining(i), 0)
    : Number(student.finance.balance);

  const slots = targets.map((i) => ({
    seq: i.is_carryover ? 0 : i.seq,
    carry: Boolean(i.is_carryover),
  }));
  const what = describeSlots(slots) || 'Detyrimi i mbetur';
  const description =
    `${what} — ${student.category_name}, viti shkollor ${student.generation}`;
  return buildFletepagesa(student, Math.round(amount * 100) / 100 > 0 ? description : 'Pagesë shkollimi', amount);
}

module.exports = {
  paymentSlip, reminderSlip, installmentsCoveredBy, describeSlots, listTemplates, generateDocument };