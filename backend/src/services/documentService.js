const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { httpError } = require('../middleware/errorHandler');
const financeService = require('./financeService');

// Vendosni shabllonin tuaj Word ketu (shiko templates/README.md)
const TEMPLATE_PATH = path.join(__dirname, '..', '..', 'templates', 'regjistrimi.docx');

const formatDate = (d) => (d ? dayjs(d).format('DD.MM.YYYY') : '');

/**
 * Gjeneron dokumentin Word te regjistrimit per nje student,
 * duke mbushur shabllonin me te dhenat e tij.
 */
async function generateRegistrationDoc(studentId) {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw httpError(
      404,
      'Shablloni Word nuk u gjet. Vendosni skedarin "regjistrimi.docx" në dosjen backend/templates.'
    );
  }

  const student = await financeService.getStudentDetail(studentId);

  const zip = new PizZip(fs.readFileSync(TEMPLATE_PATH, 'binary'));
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

  doc.render({
    emri: student.first_name,
    mbiemri: student.last_name,
    datelindja: formatDate(student.birthday),
    qyteti: student.city,
    adresa: student.address,
    emri_nenes: student.mother_name,
    emri_babait: student.father_name,
    telefoni: student.phone,
    drejtimi: student.category_name,
    gjenerata: student.generation,
    klasa: student.class_name || '',
    data_regjistrimit: formatDate(student.enrollment_date),
    kuota_vjetore: Number(student.yearly_quota).toFixed(2),
    kuota_neto: student.finance.net_quota.toFixed(2),
    data_sotme: dayjs().format('DD.MM.YYYY'),
  });

  return {
    buffer: doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }),
    filename: `Regjistrimi_${student.first_name}_${student.last_name}.docx`,
  };
}

module.exports = { generateRegistrationDoc };
