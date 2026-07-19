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
  mother_name: 'V', father_name: 'B', category_id: 1,
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
const {
  nextGeneration, currentGeneration, advanceClassName,
} = require('../src/services/promotionService');

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

test('advanceClassName: të gjitha ndarësit, edhe hapësira, pa humbje të prapashtesës', () => {
  assert.equal(advanceClassName('X/1', 2), 'XI/1');
  assert.equal(advanceClassName('X-2', 2), 'XI/2');
  assert.equal(advanceClassName('XI_3', 3), 'XII/3');
  assert.equal(advanceClassName('X A', 2), 'XI/A');   // hapësira nuk humbet më
  assert.equal(advanceClassName('X', 2), 'XI');
  assert.equal(advanceClassName(null, 2), null);
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