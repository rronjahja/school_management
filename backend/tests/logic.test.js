const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  validateStudent, isValidDate, isValidGeneration, isFiniteNumber,
} = require('../src/utils/validateStudent');

// Konfigurimi i auth kërkon JWT_SECRET; testet e helpera-ve s'kanë nevojë për të,
// por promotionService importon zinxhirin — e japim një vlerë testimi.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'x'.repeat(48);
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test';

const GOOD = {
  first_name: 'Arta', last_name: 'Krasniqi', birthday: '2010-05-14',
  city: 'Prishtinë', address: 'Rr. 1', phone: '+383 44 111 222',
  citizenship: 'Kosovar', nationality: 'Shqiptar',
  category_id: 1,
  generation: '2025/2026', study_year: 1, enrollment_date: '2025-09-01',
  yearly_quota: 1500, discount_type: 'percent', discount_value: 10,
  payment_plan: 'four',
};

test('të dhëna të plota e të sakta: zero gabime', () => {
  assert.equal(validateStudent(GOOD).length, 0);
});

test('datat: refuzohen "not-a-date", 2025-02-31, 2025-13-01', () => {
  for (const bad of ['not-a-date', '2025-02-31', '2025-13-01', '31/05/2010']) {
    const errs = validateStudent({ ...GOOD, birthday: bad });
    assert.ok(errs.length > 0, `duhet refuzuar: ${bad}`);
  }
  assert.ok(isValidDate('2024-02-29')); // vit i brishtë real
  assert.ok(!isValidDate('2025-02-29'));
});

test('numrat: "abc", "", Infinity refuzohen te kuota dhe zbritja', () => {
  assert.ok(validateStudent({ ...GOOD, yearly_quota: 'abc' }).length > 0);
  assert.ok(validateStudent({ ...GOOD, discount_value: 'abc' }).length > 0);
  assert.ok(!isFiniteNumber(''));
  assert.ok(!isFiniteNumber('Infinity'));
  assert.ok(isFiniteNumber('1500'));
});

test('gjenerata: pranohen vetëm vite të njëpasnjëshme, të plota ose të shkurtra', () => {
  assert.ok(isValidGeneration('2025/2026'));
  assert.ok(isValidGeneration('2025/26'));
  for (const bad of ['garbage', '2025/9999', '2025/2027', 'abc2025xyz', '0000', '2025']) {
    assert.ok(!isValidGeneration(bad), `duhet refuzuar: ${bad}`);
  }
});

test('zbritja: mbi 100% ose mbi kuotën refuzohet', () => {
  assert.ok(validateStudent({ ...GOOD, discount_type: 'percent', discount_value: 101 }).length > 0);
  assert.ok(validateStudent({ ...GOOD, discount_type: 'amount', discount_value: 2000 }).length > 0);
  assert.equal(validateStudent({ ...GOOD, discount_type: 'amount', discount_value: 1500 }).length, 0);
});

test('mosha: datëlindje e pamundur për nxënës refuzohet', () => {
  const now = new Date().getFullYear();
  assert.ok(validateStudent({ ...GOOD, birthday: `${now - 3}-01-01` }).length > 0);
  assert.ok(validateStudent({ ...GOOD, birthday: '1920-01-01' }).length > 0);
});

// ---------------------------------------------------------------
// Helpera të gjeneratës dhe paraleles
// ---------------------------------------------------------------

const { normalizeGeneration } = require('../src/services/studentService');
const { nextGeneration, currentGeneration } = require('../src/services/promotionService');

test('normalizeGeneration: plotëson formën e shkurtër, NUK riparon tekste të gabuara', () => {
  assert.equal(normalizeGeneration('2025/26'), '2025/2026');
  assert.equal(normalizeGeneration('2025/2026'), '2025/2026');
  // vlerat e gabuara kthehen të paprekura që validimi t'i refuzojë
  assert.equal(normalizeGeneration('abc2025xyz'), 'abc2025xyz');
  assert.equal(normalizeGeneration('garbage'), 'garbage');
});

test('nextGeneration: 2024/2025 -> 2025/2026; e pavlefshmja -> null', () => {
  assert.equal(nextGeneration('2024/2025'), '2025/2026');
  assert.equal(nextGeneration('2024/25'), '2025/2026');
  assert.equal(nextGeneration('garbage'), null);
});

test('currentGeneration: kufiri i gushtit', () => {
  assert.equal(currentGeneration(new Date('2026-07-19')), '2025/2026');
  assert.equal(currentGeneration(new Date('2026-08-01')), '2026/2027');
});

test('paralelja: ruhet vetëm numri, prefiksi vjen nga viti i studimit', () => {
  const ROMAN = { 1: 'X', 2: 'XI', 3: 'XII' };
  const classLabel = (y, c) =>
    c === null || c === undefined || String(c).trim() === ''
      ? '—'
      : (ROMAN[y] ? `${ROMAN[y]}/${String(c).trim()}` : String(c).trim());

  assert.equal(classLabel(1, '1'), 'X/1');
  assert.equal(classLabel(2, '1'), 'XI/1');   // kalimi i vitit nuk prek te dhenat
  assert.equal(classLabel(3, '2'), 'XII/2');
  assert.equal(classLabel(2, null), '—');
  // viti dhe paralelja nuk mund te bien ne kundershtim: prefiksi eshte gjithmone i derivuar
  assert.equal(classLabel(3, '1'), 'XII/1');
});

test('validimi i paraleles: vetëm numra', () => {
  const { validateStudent } = require('../src/utils/validateStudent');
  const base = { ...GOOD };
  assert.equal(validateStudent({ ...base, class_name: '1' }).length, 0);
  assert.equal(validateStudent({ ...base, class_name: '12' }).length, 0);
  assert.equal(validateStudent({ ...base, class_name: '' }).length, 0);   // opsionale
  assert.ok(validateStudent({ ...base, class_name: 'X/1' }).length > 0);
  assert.ok(validateStudent({ ...base, class_name: 'A' }).length > 0);
});

// ---------------------------------------------------------------
// Helpera të frontend-it (kopje logjike — testohen që të mos ndryshojnë heshtur)
// ---------------------------------------------------------------

test('shortGen dhe parallel (logjika e shfaqjes)', () => {
  const shortGen = (g) => {
    const m = String(g || '').match(/(\d{4})\s*\/\s*(\d{2,4})/);
    return m ? `${m[1]}/${m[2].slice(-2)}` : g || '—';
  };
  const parallel = (c) => (!c ? '—' : String(c).replace(/\s*[-–_]\s*/, '/'));
  assert.equal(shortGen('2026/2027'), '2026/27');
  assert.equal(parallel('X-1'), 'X/1');
  assert.equal(parallel('X/4'), 'X/4');
});


// ---------------------------------------------------------------
// Prindërit dhe kontakti i parë
// ---------------------------------------------------------------

test('emrat e prindërve nuk janë të detyrueshëm', () => {
  const { mother_name, father_name, ...pa_prinder } = { ...GOOD, mother_name: 'V', father_name: 'B' };
  assert.equal(validateStudent(pa_prinder).length, 0);
});

test('kontakti i parë: nëna, babai ose kujdestari', () => {
  assert.equal(validateStudent({ ...GOOD, primary_contact: 'mother' }).length, 0);
  assert.equal(validateStudent({ ...GOOD, primary_contact: 'father' }).length, 0);
  assert.equal(
    validateStudent({ ...GOOD, primary_contact: 'guardian', guardian_name: 'Agim' }).length, 0
  );
  assert.ok(validateStudent({ ...GOOD, primary_contact: 'gjyshja' }).length > 0);
});

test('me kujdestar ligjor, emri i tij është i detyrueshëm', () => {
  assert.ok(validateStudent({ ...GOOD, primary_contact: 'guardian' }).length > 0);
  assert.equal(
    validateStudent({ ...GOOD, primary_contact: 'guardian', guardian_name: 'Agim' }).length, 0
  );
  // pa kujdestar, asnje emer nuk kerkohet
  assert.equal(validateStudent({ ...GOOD, primary_contact: 'father' }).length, 0);
});

test('telefonat e prindërve validohen kur jepen, por janë opsionalë', () => {
  assert.equal(validateStudent({ ...GOOD, mother_phone: '', father_phone: '' }).length, 0);
  assert.equal(validateStudent({ ...GOOD, mother_phone: '+383 44 111 222' }).length, 0);
  assert.ok(validateStudent({ ...GOOD, mother_phone: '12' }).length > 0);
  assert.ok(validateStudent({ ...GOOD, father_phone: 'abc' }).length > 0);
});

test('rikujtesa zgjedh emrin sipas kontaktit të parë, me rezervë tjetrin', () => {
  // e njejta logjike si te frontend/src/utils/reminder.js
  const parentContact = (s) => {
    const full = (a, b) => [a, b].filter(Boolean).join(' ').trim();
    const mother = full(s.mother_name, s.mother_last_name);
    const father = full(s.father_name, s.father_last_name);
    const guardian = full(s.guardian_name, s.guardian_last_name);
    if (s.primary_contact === 'guardian') return guardian || father || mother || 'prind/kujdestar';
    const chosen = s.primary_contact === 'mother' ? mother : father;
    const other = s.primary_contact === 'mother' ? father : mother;
    return chosen || other || 'prind/kujdestar';
  };

  assert.equal(
    parentContact({ guardian_name: 'Agim', guardian_last_name: 'Berisha', primary_contact: 'guardian' }),
    'Agim Berisha'
  );

  const both = { mother_name: 'Mira', mother_last_name: 'Krasniqi', father_name: 'Fatos', father_last_name: 'Krasniqi' };
  assert.equal(parentContact({ ...both, primary_contact: 'mother' }), 'Mira Krasniqi');
  assert.equal(parentContact({ ...both, primary_contact: 'father' }), 'Fatos Krasniqi');
  // zgjedhur nena, por vetem babai ka emer -> perdoret babai
  assert.equal(parentContact({ father_name: 'Fatos', primary_contact: 'mother' }), 'Fatos');
  // asnje emer
  assert.equal(parentContact({ primary_contact: 'father' }), 'prind/kujdestar');
});


// ---------------------------------------------------------------
// Kuota vjetore sipas drejtimit
// ---------------------------------------------------------------

test('kuota merret nga drejtimi, me rezervë vlerën e dërguar', () => {
  // e njejta logjike si quotaForCategory() te studentService
  const pick = (cat, sent) =>
    cat && cat.default_quota !== null && cat.default_quota !== undefined
      ? Number(cat.default_quota)
      : sent;

  assert.equal(pick({ default_quota: 1400 }, 50), 1400);   // konfigurimi fiton
  assert.equal(pick({ default_quota: 0 }, 900), 0);        // 0 eshte vlere e vlefshme
  assert.equal(pick({ default_quota: null }, 1111), 1111); // pa konfigurim -> vlera e derguar
  assert.equal(pick(null, 1111), 1111);                    // drejtim i panjohur
});


test('shtetësia dhe kombësia janë të detyrueshme', () => {
  assert.equal(validateStudent(GOOD).length, 0);

  const { citizenship, ...paShtetesi } = GOOD;
  assert.deepEqual(validateStudent(paShtetesi), ['Shtetësia është e detyrueshme.']);

  const { nationality, ...paKombesi } = GOOD;
  assert.deepEqual(validateStudent(paKombesi), ['Kombësia është e detyrueshme.']);

  // hapesirat bosh nuk vlejne si vlere
  assert.equal(validateStudent({ ...GOOD, citizenship: '   ' }).length, 1);
});


// ---------------------------------------------------------------
// Gjinia dhe përshëndetja e rikujtesës
// ---------------------------------------------------------------

// E njejta logjike si te frontend/src/utils/reminder.js
function primaryContactInfo(s) {
  const full = (a, b) => [a, b].filter(Boolean).join(' ').trim();
  const mother = { name: full(s.mother_name, s.mother_last_name), gender: 'f' };
  const father = { name: full(s.father_name, s.father_last_name), gender: 'm' };
  const guardian = { name: full(s.guardian_name, s.guardian_last_name), gender: s.guardian_gender || null };
  const order = s.primary_contact === 'guardian' ? [guardian, father, mother]
    : s.primary_contact === 'mother' ? [mother, father] : [father, mother];
  return order.find((c) => c.name) || { name: 'prind/kujdestar', gender: null };
}
const salutation = (g) => (g === 'm' ? 'i nderuar z.' : g === 'f' ? 'e nderuara znj.' : 'i/e nderuar');

test('përshëndetja lakohet sipas gjinisë së kontaktit të parë', () => {
  const both = { mother_name: 'Mira', father_name: 'Fatos' };
  assert.equal(salutation(primaryContactInfo({ ...both, primary_contact: 'mother' }).gender), 'e nderuara znj.');
  assert.equal(salutation(primaryContactInfo({ ...both, primary_contact: 'father' }).gender), 'i nderuar z.');
  // kujdestari sipas gjinise se vet
  assert.equal(
    salutation(primaryContactInfo({ guardian_name: 'Agim', guardian_gender: 'm', primary_contact: 'guardian' }).gender),
    'i nderuar z.'
  );
  assert.equal(
    salutation(primaryContactInfo({ guardian_name: 'Vera', guardian_gender: 'f', primary_contact: 'guardian' }).gender),
    'e nderuara znj.'
  );
  // pa gjini te kujdestarit -> trajta asnjanese, pa titull
  assert.equal(
    salutation(primaryContactInfo({ guardian_name: 'A', primary_contact: 'guardian' }).gender),
    'i/e nderuar'
  );
});

test('gjinia ndjek personin real, jo zgjedhjen: zgjedhur nëna por vetëm babai ka emër', () => {
  const info = primaryContactInfo({ father_name: 'Fatos', primary_contact: 'mother' });
  assert.equal(info.name, 'Fatos');
  assert.equal(salutation(info.gender), 'i nderuar z.'); // JO "e nderuara znj. Fatos"
});

test('trajta e nxënësit sipas gjinisë', () => {
  const forms = (g) => (g === 'm' ? 'të nxënësit' : g === 'f' ? 'të nxënëses' : 'të nxënësit/es');
  assert.equal(forms('m'), 'të nxënësit');
  assert.equal(forms('f'), 'të nxënëses');
  assert.equal(forms(null), 'të nxënësit/es');
});

test('validimi i gjinisë: vetëm m ose f, por opsionale', () => {
  assert.equal(validateStudent({ ...GOOD, gender: 'm' }).length, 0);
  assert.equal(validateStudent({ ...GOOD, gender: 'f' }).length, 0);
  assert.equal(validateStudent({ ...GOOD, gender: '' }).length, 0);
  assert.ok(validateStudent({ ...GOOD, gender: 'x' }).length > 0);
  assert.ok(validateStudent({ ...GOOD, guardian_gender: 'z' }).length > 0);
});

test('e-mailet e prindërve: opsionale, por të sakta kur jepen', () => {
  assert.equal(validateStudent({ ...GOOD, mother_email: '' }).length, 0);
  assert.equal(validateStudent({ ...GOOD, mother_email: 'mira@email.com' }).length, 0);
  assert.deepEqual(validateStudent({ ...GOOD, father_email: 'jo-email' }),
    ['E-maili i babait nuk është i vlefshëm.']);
});

// ---------------------------------------------------------------
// Data e pagesës rreth mesnatës
// ---------------------------------------------------------------

test('pagesa "sot" pranohet edhe kur data lokale i printon UTC-së (mesnata)', () => {
  const { paymentDateTooFar } = require('../src/services/paymentService');

  // Ora 22:30 UTC me 19 korrik = 00:30 me 20 korrik ne Kosove (UTC+2).
  // Perdoruesi shkruan "2026-07-20" — data e tij e sotme.
  const nowUtc = Date.parse('2026-07-19T22:30:00Z');
  assert.equal(paymentDateTooFar('2026-07-20', nowUtc), false); // BUG-u i vjeter e refuzonte
  assert.equal(paymentDateTooFar('2026-07-19', nowUtc), false);
  assert.equal(paymentDateTooFar('2026-07-21', nowUtc), true);  // vertet e ardhme
  assert.equal(paymentDateTooFar('2026-08-01', nowUtc), true);
});


// ---------------------------------------------------------------
// Eksporti në Excel
// ---------------------------------------------------------------

const {
  bankShortName, allocateDetailed, SHEET_ORDER,
} = require('../src/services/exportService');

test('emrat e shkurtër të bankave për kolonën "Banka"', () => {
  assert.equal(bankShortName('TEB Bank'), 'TEB');
  assert.equal(bankShortName('NLB Banka'), 'NLB');
  assert.equal(bankShortName('RBKO'), 'RBKO');
  assert.equal(bankShortName('ProCredit Bank'), 'ProCredit');
  // shkurtesa tregtare qe nuk nxirret dot nga emri
  assert.equal(bankShortName('Raiffeisen Bank'), 'RBKO');
  assert.equal(bankShortName('Raiffeisen'), 'RBKO');
  // emrat shumëfjalëshë bëhen akronime, si i shkruan vetë shkolla
  assert.equal(bankShortName('Banka për Biznes'), 'BpB');
  assert.equal(bankShortName('Banka Kombëtare Tregtare'), 'BKT');
});

test('rendi i fletëve është ai i shkollës', () => {
  assert.deepEqual(SHEET_ORDER, ['TD', 'BPI', 'AF', 'TF', 'TIK']);
});

test('shpërndarja e pagesave mbi blloqet: FIFO, pagesa ndahet mes kësteve', () => {
  const insts = [
    { seq: 1, amount: 225, is_carryover: 0 },
    { seq: 2, amount: 225, is_carryover: 0 },
    { seq: 3, amount: 225, is_carryover: 0 },
    { seq: 4, amount: 225, is_carryover: 0 },
  ];
  const pays = [{ amount: 600, payment_date: '2025-10-01', method: 'bank', bank_name: 'TEB Bank' }];
  const slots = allocateDetailed(insts, pays, 0);
  assert.deepEqual(slots.map((s) => s.paid), [225, 225, 150, 0]);
  assert.equal(slots[2].last.bank, 'TEB Bank'); // kësti 3 pjesërisht, nga e njëjta pagesë
  assert.equal(slots[3].last, null);            // kësti 4 i paprekur -> blloku bosh
});

test('bartja (seq 0) merr bllokun "Kontakt" dhe paguhet e para', () => {
  const insts = [
    { seq: 1, amount: 500, is_carryover: 0 },
    { seq: 0, amount: 400, is_carryover: 1 }, // rendi në hyrje s\'ka rëndësi
  ];
  const pays = [
    { amount: 400, payment_date: '2025-09-10', method: 'cash', bank_name: null },
    { amount: 250, payment_date: '2025-10-15', method: 'bank', bank_name: 'BKT' },
  ];
  const slots = allocateDetailed(insts, pays, 0);
  assert.equal(slots[0].seq, 0);
  assert.equal(slots[0].paid, 400);
  assert.equal(slots[0].last.method, 'cash');
  assert.equal(slots[1].paid, 250);
  assert.equal(slots[1].last.bank, 'BKT');
});

test('settled_paid digjet nga pagesat e para, jo nga këstet aktuale', () => {
  const insts = [{ seq: 1, amount: 500, is_carryover: 0 }];
  const pays = [
    { amount: 300, payment_date: '2025-01-01', method: 'cash', bank_name: null }, // e konsumuar nga viti i mbyllur
    { amount: 200, payment_date: '2025-09-01', method: 'cash', bank_name: null },
  ];
  const slots = allocateDetailed(insts, pays, 300);
  assert.equal(slots[0].paid, 200); // vetëm pjesa efektive
});


// ---------------------------------------------------------------
// Migrimi i kontratave (.docx -> formulari i regjistrimit)
// ---------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { parseContractDocx } = require('../src/services/contractImportService');

test('kontrata reale lexohet e plotë', () => {
  const buf = fs.readFileSync(path.join(__dirname, 'kontrata-shembull.docx'));
  const { data, warnings } = parseContractDocx(buf);

  assert.equal(data.first_name, 'Afron');
  assert.equal(data.last_name, 'Ferizi');
  assert.equal(data.birthday, '2010-01-07');          // 07/01/2010, dita e para
  assert.equal(data.city, 'Prishtinë');
  assert.equal(data.contract_number, '22/2025/TF');
  assert.equal(data.category_code, 'TF');             // nga numri i kontratës
  assert.equal(data.phone, null);                     // "/" = pa vlerë
  assert.equal(data.citizenship, 'Kosovar');
  assert.equal(data.email, 'afronamar1@gmail.com');
  assert.equal(data.yearly_quota, 1600);              // Çmimi bazë
  assert.equal(data.generation, '2025/2026');
  assert.equal(data.enrollment_date, '2025-08-22');   // Datë: 22/08/2025
  assert.equal(data.address, 'Rr. Qëndresa, Prishtinë.');

  // dy emrat në një qelizë ndahen si paragrafë: babai i pari, nëna e dyta
  assert.equal(data.father_name, 'Afrim');
  assert.equal(data.mother_name, 'Elvire');
  assert.equal(data.father_last_name, 'Ferizi');
  assert.equal(data.mother_last_name, 'Ferizi');

  // "i përfaqësuar nga Prindi/Kujdestari Afrim Ferizi" -> të dhënat te babai
  assert.equal(data.primary_contact, 'father');
  assert.equal(data.father_phone, '044 989 803');
  assert.equal(data.father_birthday, '1978-03-04');
  assert.equal(data.father_personal_id, '2010942147');
  assert.equal(data.father_email, null);
  assert.equal(data.mother_phone, undefined); // asgjë nuk i mvishet nënës

  // ajo që s'është në dokument shënohet si paralajmërim, jo si gabim
  assert.ok(warnings.some((w) => w.includes('Plani i pagesës')));
});

test('skedari që s\'është docx refuzohet qartë', () => {
  assert.throws(
    () => parseContractDocx(Buffer.from('kjo nuk eshte zip')),
    /dokument Word/
  );
});


// ---------------------------------------------------------------
// Fletëpagesa
// ---------------------------------------------------------------

const {
  describeSlots, installmentsCoveredBy,
} = require('../src/services/documentService');

test('përshkrimi i pagesës sipas kësteve që mbuloi', () => {
  assert.equal(describeSlots([{ seq: 1 }]), 'Kësti 1');
  assert.equal(describeSlots([{ seq: 1 }, { seq: 2 }]), 'Kësti 1 dhe 2');
  assert.equal(describeSlots([{ seq: 1 }, { seq: 2 }, { seq: 3 }]), 'Kësti 1, 2 dhe 3');
  assert.equal(describeSlots([{ seq: 0, carry: true }]), 'Borxhi i vitit të kaluar');
  assert.equal(
    describeSlots([{ seq: 0, carry: true }, { seq: 1 }]),
    'Borxhi i vitit të kaluar dhe Kësti 1'
  );
  assert.equal(describeSlots([]), '');
});

test('installmentsCoveredBy gjen këstet e NJË pagese në rendin kohor', () => {
  const insts = [
    { seq: 1, amount: 500, is_carryover: 0 },
    { seq: 2, amount: 500, is_carryover: 0 },
  ];
  const pays = [
    { id: 11, amount: 500, payment_date: '2025-09-06' },
    { id: 12, amount: 300, payment_date: '2026-01-10' },
  ];
  // pagesa 11 mbuloi vetëm këstin 1; pagesa 12 vetëm pjesë të këstit 2
  assert.deepEqual(installmentsCoveredBy(11, insts, pays, 0).map((s) => s.seq), [1]);
  assert.deepEqual(installmentsCoveredBy(12, insts, pays, 0).map((s) => s.seq), [2]);

  // një pagesë e madhe përshkon dy këste
  const big = [{ id: 20, amount: 700, payment_date: '2025-09-06' }];
  assert.deepEqual(installmentsCoveredBy(20, insts, big, 0).map((s) => s.seq), [1, 2]);

  // settled_paid digjet nga pagesa e parë përpara se të prekë këstet aktuale
  assert.deepEqual(installmentsCoveredBy(11, insts, pays, 500), []);
});


// ---------------------------------------------------------------
// Shënimi i pagesës i lidhur me fletëpagesën
// ---------------------------------------------------------------

// E njejta logjike si frontend/src/utils/paymentNote.js — nese ndryshon
// njera, ky test duhet te bjere.
function slotsCoveredBy(installments, amount) {
  const EPS = 0.004;
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return [];
  const slots = installments
    .map((i) => ({
      seq: i.is_carryover ? 0 : i.seq,
      carry: Boolean(i.is_carryover),
      remaining: Number(i.amount) - Number(i.paid || 0),
    }))
    .filter((s) => s.remaining > EPS)
    .sort((a, b) => a.seq - b.seq);
  const covered = [];
  let left = value;
  for (const s of slots) {
    if (left <= EPS) break;
    covered.push(s);
    left = Math.round((left - Math.min(s.remaining, left)) * 100) / 100;
  }
  return covered;
}

test('shënimi i propozuar përputhet me përshkrimin e fletëpagesës', () => {
  const insts = [
    { seq: 1, amount: 500, paid: 500, is_carryover: 0 }, // i shlyer
    { seq: 2, amount: 500, paid: 0, is_carryover: 0 },
    { seq: 3, amount: 500, paid: 0, is_carryover: 0 },
  ];
  // pagesa mbulon vetem kestin 2
  assert.equal(describeSlots(slotsCoveredBy(insts, 500)), 'Kësti 2');
  // pagese me e madhe kalon te kesti 3
  assert.equal(describeSlots(slotsCoveredBy(insts, 700)), 'Kësti 2 dhe 3');
  // shuma zero ose bosh -> asnje kest
  assert.deepEqual(slotsCoveredBy(insts, 0), []);
  assert.deepEqual(slotsCoveredBy(insts, ''), []);
});

test('bartja del e para te shënimi', () => {
  const insts = [
    { seq: 1, amount: 500, paid: 0, is_carryover: 0 },
    { seq: 0, amount: 400, paid: 0, is_carryover: 1 },
  ];
  assert.equal(describeSlots(slotsCoveredBy(insts, 400)), 'Borxhi i vitit të kaluar');
  assert.equal(
    describeSlots(slotsCoveredBy(insts, 900)),
    'Borxhi i vitit të kaluar dhe Kësti 1'
  );
});


// ---------------------------------------------------------------
// Rolet: staf / financa / administrator
// ---------------------------------------------------------------

const { canSeeFinance } = require('../src/middleware/auth');
const { ROLES } = require('../src/services/authService');
const {
  stripStudentFinance, stripListFinance, stripDashboard,
} = require('../src/utils/redactFinance');

test('kush i sheh financat', () => {
  assert.equal(canSeeFinance({ role: 'admin' }), true);
  assert.equal(canSeeFinance({ role: 'finance' }), true);
  assert.equal(canSeeFinance({ role: 'staff' }), false);
  assert.equal(canSeeFinance(null), false);
  assert.equal(canSeeFinance({}), false);          // pa rol -> jo
  assert.equal(canSeeFinance({ role: 'FINANCE' }), false); // pa përputhje të saktë
});

test('rolet e lejuara janë saktësisht tre', () => {
  assert.deepEqual(ROLES, ['admin', 'finance', 'staff']);
});

test('redaktimi heq çdo gjurmë financiare, por ruan të dhënat e nxënësit', () => {
  const student = {
    id: 7, first_name: 'Afron', last_name: 'Ferizi',
    category_name: 'Farmaci', yearly_quota: 1600, contract_number: '22/2025/TF',
    total_paid: 800, settled_paid: 0,
    finance: { balance: 800, total_paid: 800, status: 'overdue' },
    payments: [{ id: 1, amount: 800 }],
  };
  const clean = stripStudentFinance(student);

  for (const k of ['finance', 'payments', 'total_paid', 'settled_paid']) {
    assert.ok(!(k in clean), `fusha "${k}" duhej hequr`);
  }
  // ato qe i duhen stafit mbeten
  assert.equal(clean.first_name, 'Afron');
  assert.equal(clean.contract_number, '22/2025/TF');
  assert.equal(clean.yearly_quota, 1600); // cmimi i kontrates, jo gjendje financiare

  // objekti origjinal nuk preket (redaktimi kthen kopje)
  assert.ok(student.finance);

  assert.equal(stripListFinance([student])[0].finance, undefined);
  assert.deepEqual(stripListFinance(null), []);
});

test('paneli pa shifra: mbeten numrat e nxënësve, bien shumat dhe alarmet', () => {
  const full = {
    totals: {
      students: 42, graduates: 5, collected: 12000,
      outstanding: 3400, overdue: 7, dueSoon: 2,
      graduatesInDebt: 1, graduatesDebt: 500,
    },
    categories: [
      { category_id: 1, name: 'TD', color: '#000', students: 12, collected: 900, outstanding: 100 },
    ],
    alerts: [{ id: 1 }, { id: 2 }],
    recent: [{ id: 3, first_name: 'A', finance: { status: 'overdue' } }],
  };
  const safe = stripDashboard(full);

  assert.deepEqual(Object.keys(safe.totals).sort(), ['graduates', 'students']);
  assert.equal(safe.totals.students, 42);
  assert.equal(safe.categories[0].students, 12);
  assert.equal(safe.categories[0].collected, undefined);
  assert.equal(safe.categories[0].outstanding, undefined);
  assert.deepEqual(safe.alerts, []);              // alarmet ndërtohen mbi borxhin
  assert.equal(safe.recent[0].finance, undefined);
  assert.equal(safe.recent[0].first_name, 'A');
});