const REQUIRED_FIELDS = [
  ['first_name', 'Emri'],
  ['last_name', 'Mbiemri'],
  ['birthday', 'Datëlindja'],
  ['city', 'Komuna'],
  ['address', 'Adresa'],
  ['citizenship', 'Shtetësia'],
  ['nationality', 'Kombësia'],
  ['category_id', 'Drejtimi'],
  ['generation', 'Gjenerata'],
  ['enrollment_date', 'Data e regjistrimit'],
  ['yearly_quota', 'Kuota vjetore'],
  ['payment_plan', 'Plani i pagesës'],
];

const DISCOUNT_TYPES = ['none', 'percent', 'amount'];
const PAYMENT_PLANS = ['immediate', 'two', 'four', 'six', 'monthly'];
const MAX_QUOTA = 100000;

/** Datë ISO reale (jo vetëm string që i ngjan një date). */
function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.slice(0, 10))) return false;
  const d = new Date(value.slice(0, 10));
  if (Number.isNaN(d.getTime())) return false;
  // p.sh. 2025-02-31 e kthen Date-n ne 3 mars — e kapim keshtu
  return d.toISOString().slice(0, 10) === value.slice(0, 10);
}

/** Numër i fundëm (refuzon "abc", "", null, Infinity). */
function isFiniteNumber(value) {
  if (value === '' || value === null || value === undefined) return false;
  return Number.isFinite(Number(value));
}

/** Gjenerata duhet të jetë 'YYYY/YYYY' ose 'YYYY/YY' me vite të njëpasnjëshme. */
function isValidGeneration(value) {
  const m = String(value || '').trim().match(/^(\d{4})\s*\/\s*(\d{2}|\d{4})$/);
  if (!m) return false;

  const start = Number(m[1]);
  if (start < 2000 || start > 2100) return false;

  const end = m[2].length === 2 ? Number(String(start + 1).slice(0, 2) + m[2]) : Number(m[2]);
  return end === start + 1;
}

/** Kthen listën e gabimeve; bosh nëse të dhënat janë në rregull. */
function validateStudent(body) {
  const errors = [];

  REQUIRED_FIELDS.forEach(([field, label]) => {
    const value = body[field];
    if (value === undefined || value === null || String(value).trim() === '') {
      errors.push(`${label} është e detyrueshme.`);
    }
  });

  // ---- datat ----
  if (body.birthday && !isValidDate(body.birthday)) {
    errors.push('Datëlindja nuk është datë e vlefshme (formati: VVVV-MM-DD).');
  }
  if (body.enrollment_date && !isValidDate(body.enrollment_date)) {
    errors.push('Data e regjistrimit nuk është datë e vlefshme (formati: VVVV-MM-DD).');
  }
  if (body.mother_birthday && !isValidDate(body.mother_birthday)) {
    errors.push('Datëlindja e nënës nuk është datë e vlefshme.');
  }
  if (body.father_birthday && !isValidDate(body.father_birthday)) {
    errors.push('Datëlindja e babait nuk është datë e vlefshme.');
  }

  // mosha e arsyeshme për shkollë të mesme
  if (body.birthday && isValidDate(body.birthday)) {
    const year = Number(body.birthday.slice(0, 4));
    const now = new Date().getFullYear();
    if (year > now - 10 || year < now - 80) {
      errors.push('Datëlindja duket e pasaktë — kontrolloni vitin.');
    }
  }

  // ---- drejtimi ----
  if (body.category_id !== undefined && !Number.isInteger(Number(body.category_id))) {
    errors.push('Drejtimi nuk është i vlefshëm.');
  }

  // ---- gjenerata ----
  if (body.generation && !isValidGeneration(body.generation)) {
    errors.push('Gjenerata duhet të jetë në formatin 2025/2026 me vite të njëpasnjëshme.');
  }

  // ---- kuota ----
  if (body.yearly_quota !== undefined && body.yearly_quota !== '') {
    if (!isFiniteNumber(body.yearly_quota)) {
      errors.push('Kuota vjetore duhet të jetë numër.');
    } else {
      const q = Number(body.yearly_quota);
      if (q < 0) errors.push('Kuota vjetore nuk mund të jetë negative.');
      if (q > MAX_QUOTA) errors.push(`Kuota vjetore duket e pasaktë (mbi ${MAX_QUOTA} €).`);
    }
  }

  // ---- zbritja ----
  const discountType = body.discount_type || 'none';
  if (!DISCOUNT_TYPES.includes(discountType)) {
    errors.push('Lloji i zbritjes nuk është i vlefshëm.');
  }

  if (body.discount_value !== undefined && body.discount_value !== '' && body.discount_value !== null) {
    if (!isFiniteNumber(body.discount_value)) {
      errors.push('Vlera e zbritjes duhet të jetë numër.');
    } else {
      const dv = Number(body.discount_value);
      if (dv < 0) errors.push('Zbritja nuk mund të jetë negative.');
      if (discountType === 'percent' && dv > 100) {
        errors.push('Zbritja në përqindje nuk mund të kalojë 100%.');
      }
      if (discountType === 'amount' && isFiniteNumber(body.yearly_quota) &&
          dv > Number(body.yearly_quota)) {
        errors.push('Zbritja nuk mund të jetë më e madhe se kuota vjetore.');
      }
    }
  }

  // ---- plani dhe viti ----
  if (body.payment_plan && !PAYMENT_PLANS.includes(body.payment_plan)) {
    errors.push('Plani i pagesës nuk është i vlefshëm.');
  }
  if (body.study_year !== undefined && ![1, 2, 3, '1', '2', '3'].includes(body.study_year)) {
    errors.push('Viti i studimit duhet të jetë 1, 2 ose 3.');
  }

  // ---- gjinia ----
  ['gender', 'guardian_gender'].forEach((f) => {
    const v = body[f];
    if (v !== undefined && v !== null && String(v) !== '' && !['m', 'f'].includes(v)) {
      errors.push('Gjinia duhet të jetë mashkull ose femër.');
    }
  });

  // ---- e-mailet (opsionale, por te sakta kur jepen) ----
  const EMAIL_OWNER = {
    mother_email: 'nënës', father_email: 'babait', guardian_email: 'kujdestarit',
  };
  Object.keys(EMAIL_OWNER).forEach((f) => {
    const v = body[f];
    if (v !== undefined && String(v).trim() !== '' &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim())) {
      errors.push(`E-maili i ${EMAIL_OWNER[f]} nuk është i vlefshëm.`);
    }
  });

  // ---- prinderit ----
  // Emrat nuk jane te detyrueshem. Kontakti i pare duhet te jete i vlefshem.
  if (body.primary_contact !== undefined &&
      !['mother', 'father', 'guardian'].includes(body.primary_contact)) {
    errors.push('Kontakti i parë duhet të jetë nëna, babai ose kujdestari ligjor.');
  }

  // Me kujdestar ligjor, emri i tij eshte i detyrueshem — pa te, mesazhet
  // e rikujteses nuk kane kujt t'i drejtohen.
  if (body.primary_contact === 'guardian' &&
      String(body.guardian_name || '').trim() === '') {
    errors.push('Emri i kujdestarit ligjor është i detyrueshëm.');
  }

  if (body.guardian_birthday && !isValidDate(body.guardian_birthday)) {
    errors.push('Datëlindja e kujdestarit nuk është datë e vlefshme.');
  }

  const PHONE_OWNER = {
    mother_phone: 'nënës',
    father_phone: 'babait',
    guardian_phone: 'kujdestarit',
  };
  Object.keys(PHONE_OWNER).forEach((f) => {
    const v = body[f];
    if (v !== undefined && String(v).trim() !== '' && String(v).replace(/\D/g, '').length < 6) {
      errors.push(`Numri i telefonit të ${PHONE_OWNER[f]} duket i pasaktë.`);
    }
  });

  // Numri personal: shifra, gjatesi e arsyeshme
  [['mother_personal_id', 'nënës'], ['father_personal_id', 'babait'],
   ['guardian_personal_id', 'kujdestarit']].forEach(([f, kujt]) => {
    const v = body[f];
    if (v !== undefined && String(v).trim() !== '' && !/^\d{6,20}$/.test(String(v).trim())) {
      errors.push(`Numri personal i ${kujt} duhet të jetë 6-20 shifra.`);
    }
  });

  // ---- paralelja ----
  // Ruhet vetem numri; viti (X/XI/XII) shtohet automatikisht ne shfaqje.
  if (body.class_name !== undefined && String(body.class_name).trim() !== '') {
    if (!/^\d{1,2}$/.test(String(body.class_name).trim())) {
      errors.push('Paralelja duhet të jetë vetëm numër (p.sh. 1, 2, 3).');
    }
  }

  // ---- kontakti ----
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email))) {
    errors.push('E-maili i nxënësit nuk është i vlefshëm.');
  }
  if (body.phone && String(body.phone).replace(/\D/g, '').length < 6) {
    errors.push('Numri i telefonit duket i pasaktë.');
  }

  return errors;
}

module.exports = { validateStudent, isValidDate, isValidGeneration, isFiniteNumber };