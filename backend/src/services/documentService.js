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
    numri_personal: student.guardian_personal_id || '',
    telefoni_prindit: student.guardian_phone || '',
    emaili_prindit: student.guardian_email || '',

    // Shkollimi
    drejtimi: student.category_name,
    gjenerata: student.generation,
    klasa: student.class_name || '',
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

    // Pasqyra e kesteve — perdoret ne bllokun {#keste}...{/keste}
    keste: f.installments.map((i) => ({
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