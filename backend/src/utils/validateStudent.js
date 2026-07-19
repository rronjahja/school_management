const REQUIRED_FIELDS = [
  ['first_name', 'Emri'],
  ['last_name', 'Mbiemri'],
  ['birthday', 'Datëlindja'],
  ['city', 'Qyteti'],
  ['address', 'Adresa'],
  ['mother_name', 'Emri i nënës'],
  ['father_name', 'Emri i babait'],
  ['phone', 'Numri i telefonit'],
  ['category_id', 'Drejtimi'],
  ['generation', 'Gjenerata'],
  ['enrollment_date', 'Data e regjistrimit'],
  ['yearly_quota', 'Kuota vjetore'],
  ['payment_plan', 'Plani i pagesës'],
];

const DISCOUNT_TYPES = ['none', 'percent', 'amount'];
const PAYMENT_PLANS = ['immediate', 'two', 'four', 'six', 'monthly'];

/** Kthen listen e gabimeve; bosh nese te dhenat jane ne rregull. */
function validateStudent(body) {
  const errors = [];

  REQUIRED_FIELDS.forEach(([field, label]) => {
    const value = body[field];
    if (value === undefined || value === null || String(value).trim() === '') {
      errors.push(`${label} është e detyrueshme.`);
    }
  });

  if (body.yearly_quota !== undefined && Number(body.yearly_quota) < 0) {
    errors.push('Kuota vjetore nuk mund të jetë negative.');
  }

  const discountType = body.discount_type || 'none';
  if (!DISCOUNT_TYPES.includes(discountType)) {
    errors.push('Lloji i zbritjes nuk është i vlefshëm.');
  }

  const discountValue = Number(body.discount_value || 0);
  if (discountValue < 0) errors.push('Zbritja nuk mund të jetë negative.');
  if (discountType === 'percent' && discountValue > 100) {
    errors.push('Zbritja në përqindje nuk mund të kalojë 100%.');
  }
  if (discountType === 'amount' && discountValue > Number(body.yearly_quota || 0)) {
    errors.push('Zbritja nuk mund të jetë më e madhe se kuota vjetore.');
  }

  if (body.payment_plan && !PAYMENT_PLANS.includes(body.payment_plan)) {
    errors.push('Plani i pagesës nuk është i vlefshëm.');
  }

  return errors;
}

module.exports = { validateStudent };