const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildInstallments,
  computeNetQuota,
  summarizeFinance,
} = require('../src/utils/finance');

const sum = (list) => Math.round(list.reduce((a, i) => a + i.amount, 0) * 100) / 100;
const dates = (list) => list.map((i) => i.due_date);

// ---------------------------------------------------------------
// Planet e pagesës (Neni 6 i kontratës)
// ---------------------------------------------------------------

test('immediate: 1 kest, 5 ditë pas regjistrimit', () => {
  const r = buildInstallments(1350, 'immediate', '2025-09-01', '2025/2026');
  assert.equal(r.length, 1);
  assert.equal(r[0].due_date, '2025-09-06');
  assert.equal(sum(r), 1350);
});

test('two: +5 ditë dhe 25 janari i vitit pasues', () => {
  const r = buildInstallments(1350, 'two', '2025-09-01', '2025/2026');
  assert.deepEqual(dates(r), ['2025-09-06', '2026-01-25']);
  assert.deepEqual(r.map((i) => i.amount), [675, 675]);
});

test('four: +5d, 15 nëntor, 10 shkurt, 15 prill', () => {
  const r = buildInstallments(1500, 'four', '2025-09-01', '2025/2026');
  assert.deepEqual(dates(r), ['2025-09-06', '2025-11-15', '2026-02-10', '2026-04-15']);
  assert.deepEqual(r.map((i) => i.amount), [375, 375, 375, 375]);
});

test('six: 30% në regjistrim + 5 data fikse', () => {
  const r = buildInstallments(1500, 'six', '2025-09-01', '2025/2026');
  assert.deepEqual(dates(r), [
    '2025-09-01', '2025-11-15', '2025-12-30', '2026-02-10', '2026-04-10', '2026-05-15',
  ]);
  assert.equal(r[0].amount, 450); // 30%
  assert.equal(r[1].amount, 210); // (1500-450)/5
  assert.equal(sum(r), 1500);
});

test('monthly: 12 muaj kalendarikë nga regjistrimi', () => {
  const r = buildInstallments(1200, 'monthly', '2025-09-15', '2025/2026');
  assert.equal(r.length, 12);
  assert.equal(r[0].due_date, '2025-09-15');
  assert.equal(r[11].due_date, '2026-08-15');
  assert.equal(sum(r), 1200);
});

// ---------------------------------------------------------------
// Ankorimi sipas gjeneratës (rregullimi kryesor)
// ---------------------------------------------------------------

test('regjistrim veror për vitin e ARDHSHËM: datat i takojnë gjeneratës, jo datës', () => {
  // korrik 2026, gjenerata 2026/2027 — rasti i regjistrimeve të verës
  const r = buildInstallments(1500, 'four', '2026-07-06', '2026/2027');
  assert.deepEqual(dates(r), ['2026-07-11', '2026-11-15', '2027-02-10', '2027-04-15']);
});

test('pa gjeneratë: rikthehet te rregulli i datës së regjistrimit', () => {
  const r = buildInstallments(1500, 'four', '2025-09-01');
  assert.deepEqual(dates(r), ['2025-09-06', '2025-11-15', '2026-02-10', '2026-04-15']);
});

test('regjistrim i vonuar brenda vitit: datat e kaluara ngjiten te kësti i parë', () => {
  // janar 2026 për gjeneratën 2025/2026 — 15 nëntori ka kaluar
  const r = buildInstallments(1000, 'four', '2026-01-10', '2025/2026');
  assert.deepEqual(dates(r), ['2026-01-15', '2026-01-15', '2026-02-10', '2026-04-15']);
});

test('gjenerata e shkurtër dhe e plotë japin të njëjtat data', () => {
  const a = buildInstallments(1000, 'six', '2025-09-01', '2025/2026');
  const b = buildInstallments(1000, 'six', '2025-09-01', '2025/26');
  assert.deepEqual(dates(a), dates(b));
});

// ---------------------------------------------------------------
// Rrumbullakimi — shuma e kësteve GJITHMONË = kuota neto
// ---------------------------------------------------------------

test('shumat që s\'ndahen saktë: kësti i fundit e absorbon diferencën', () => {
  for (const [net, plan] of [
    [1000, 'monthly'], [999.99, 'monthly'], [1234.56, 'four'],
    [777.77, 'six'], [0.01, 'two'], [1499.995, 'four'],
  ]) {
    const rounded = Math.round(net * 100) / 100;
    const r = buildInstallments(rounded, plan, '2025-09-01', '2025/2026');
    assert.equal(sum(r), rounded, `${plan} me ${net}`);
    r.forEach((i) => assert.ok(i.amount >= 0, 'asnjë kest negativ'));
  }
});

test('kuota zero (bursë e plotë): këstet ekzistojnë me vlerë 0', () => {
  const r = buildInstallments(0, 'four', '2025-09-01', '2025/2026');
  assert.equal(sum(r), 0);
  assert.equal(r.length, 4);
});

// ---------------------------------------------------------------
// computeNetQuota
// ---------------------------------------------------------------

test('zbritjet: përqindje, shumë fikse, asnjë, dhe kufijtë', () => {
  assert.equal(computeNetQuota(1500, 'percent', 10), 1350);
  assert.equal(computeNetQuota(1500, 'amount', 100), 1400);
  assert.equal(computeNetQuota(1500, 'none', 999), 1500);
  assert.equal(computeNetQuota(1500, 'percent', 100), 0);
  assert.equal(computeNetQuota(1500, 'amount', 2000), 0); // kurrë negative
});

// ---------------------------------------------------------------
// summarizeFinance: shpërndarja FIFO, statuset, ndarja e viteve
// ---------------------------------------------------------------

function studentWith(installments, paid, generation = '2025/2026') {
  return summarizeFinance(
    { generation, yearly_quota: 1000, discount_type: 'none', discount_value: 0 },
    installments,
    paid,
    require('dayjs')('2026-07-19')
  );
}

test('FIFO: pagesa mbush këstet me radhë', () => {
  const insts = buildInstallments(1000, 'four', '2025-09-01', '2025/2026');
  const r = studentWith(insts, 300);
  assert.equal(r.installments[0].paid, 250);
  assert.equal(r.installments[0].status, 'paid');
  assert.equal(r.installments[1].paid, 50);
  assert.equal(r.installments[1].status, 'overdue');
  assert.equal(r.balance, 700);
});

test('mbipagesa: borxhi 0, statusi paid, paguar ruhet siç është', () => {
  const insts = buildInstallments(1000, 'immediate', '2025-09-01', '2025/2026');
  const r = studentWith(insts, 1500);
  assert.equal(r.balance, 0);
  assert.equal(r.status, 'paid');
  assert.equal(r.total_paid, 1500);
});

test('statuset: overdue / due-soon / upcoming sipas datës 19.07.2026', () => {
  const insts = [
    { seq: 1, due_date: '2026-07-10', amount: 100, generation: '2025/2026' }, // kaluar
    { seq: 2, due_date: '2026-07-24', amount: 100, generation: '2025/2026' }, // brenda 7 ditësh
    { seq: 3, due_date: '2026-09-01', amount: 100, generation: '2025/2026' }, // larg
  ];
  const r = studentWith(insts, 0);
  assert.equal(r.installments[0].status, 'overdue');
  assert.equal(r.installments[1].status, 'due-soon');
  assert.equal(r.installments[2].status, 'upcoming');
  assert.equal(r.status, 'overdue'); // statusi i studentit = më i keqi
});

test('ndarja e viteve: aktual + të kaluarit = totali, borxhi i trashëguar i saktë', () => {
  const y1 = buildInstallments(1000, 'two', '2024-09-01', '2024/2025')
    .map((i) => ({ ...i, generation: '2024/2025' }));
  const y2 = buildInstallments(1200, 'two', '2025-09-01', '2025/2026')
    .map((i) => ({ ...i, seq: i.seq + 2, generation: '2025/2026' }));

  const r = summarizeFinance(
    { generation: '2025/2026', yearly_quota: 1200, discount_type: 'none', discount_value: 0 },
    [...y1, ...y2],
    1500,
    require('dayjs')('2026-07-19')
  );
  assert.equal(r.total_due, 2200);
  assert.equal(r.current_year_due + r.past_years_due, r.total_due);
  assert.equal(r.past_years_balance, 0);      // 1000 e vitit të parë mbulohet e para (FIFO)
  assert.equal(r.current_year_paid, 500);
  assert.equal(r.balance, 700);
});

// ---------------------------------------------------------------
// Borxhi i vitit të kaluar (kalimi i vitit)
// ---------------------------------------------------------------

test('carryover i papaguar është GJITHMONË i kuq, edhe me afat në të ardhmen', () => {
  const insts = [
    { seq: 1, due_date: '2026-09-01', amount: 400, generation: '2025/2026', is_carryover: 1 },
    { seq: 2, due_date: '2026-09-06', amount: 500, generation: '2026/2027' },
  ];
  const r = summarizeFinance(
    { generation: '2026/2027', yearly_quota: 1000, discount_type: 'none', discount_value: 0, settled_paid: 0 },
    insts, 0, require('dayjs')('2026-07-19')
  );
  assert.equal(r.installments[0].status, 'overdue'); // afati 01.09 s'ka ardhur, por është borxh i bartur
  assert.equal(r.installments[1].status, 'upcoming');
});

test('settled_paid: pagesat e konsumuara nga këstet e hequra nuk numërohen dy herë', () => {
  // Historia: viti 1 kishte 1000 €, u paguan 600 €, u mbyll viti:
  //   -> settled_paid = 600, carryover = 400, viti i ri = 1200
  const insts = [
    { seq: 1, due_date: '2026-09-01', amount: 400, generation: '2025/2026', is_carryover: 1 },
    { seq: 2, due_date: '2026-09-06', amount: 600, generation: '2026/2027' },
    { seq: 3, due_date: '2027-01-25', amount: 600, generation: '2026/2027' },
  ];
  const student = {
    generation: '2026/2027', yearly_quota: 1200,
    discount_type: 'none', discount_value: 0, settled_paid: 600,
  };
  const d = require('dayjs')('2026-07-19');

  // pagesat gjithsej 600 — të gjitha të konsumuara nga viti i mbyllur
  let r = summarizeFinance(student, insts, 600, d);
  assert.equal(r.total_paid, 0);        // asgjë efektive mbi strukturën aktuale
  assert.equal(r.lifetime_paid, 600);   // historiku i plotë ruhet
  assert.equal(r.balance, 1600);        // 400 borxh i bartur + 1200 viti i ri
  assert.equal(r.past_years_balance, 400);

  // paguan edhe 400 -> mbulohet i pari borxhi i bartur (FIFO)
  r = summarizeFinance(student, insts, 1000, d);
  assert.equal(r.installments[0].paid, 400);
  assert.equal(r.installments[0].status, 'paid'); // i shlyer -> jo më i kuq
  assert.equal(r.past_years_balance, 0);
  assert.equal(r.balance, 1200);
});

test('bilanci i pandryshuar nga mbyllja e vitit (invarianca e llogarisë)', () => {
  const d = require('dayjs')('2026-07-19');
  // PARA mbylljes: 2 vite me këste të plota
  const before = summarizeFinance(
    { generation: '2026/2027', yearly_quota: 1200, discount_type: 'none', discount_value: 0, settled_paid: 0 },
    [
      { seq: 1, due_date: '2025-09-06', amount: 500, generation: '2025/2026' },
      { seq: 2, due_date: '2026-01-25', amount: 500, generation: '2025/2026' },
      { seq: 3, due_date: '2026-09-06', amount: 600, generation: '2026/2027' },
      { seq: 4, due_date: '2027-01-25', amount: 600, generation: '2026/2027' },
    ], 600, d
  );
  // PAS mbylljes: e njëjta gjendje e shprehur me carryover + settled
  const after = summarizeFinance(
    { generation: '2026/2027', yearly_quota: 1200, discount_type: 'none', discount_value: 0, settled_paid: 600 },
    [
      { seq: 1, due_date: '2026-09-01', amount: 400, generation: '2025/2026', is_carryover: 1 },
      { seq: 2, due_date: '2026-09-06', amount: 600, generation: '2026/2027' },
      { seq: 3, due_date: '2027-01-25', amount: 600, generation: '2026/2027' },
    ], 600, d
  );
  assert.equal(before.balance, after.balance);
  assert.equal(before.past_years_balance, after.past_years_balance);
  assert.equal(before.current_year_balance, after.current_year_balance);
});


// ---------------------------------------------------------------
// Të diplomuarit me borxh
// ---------------------------------------------------------------

test('i diplomuar me borxh është "Vonesë", jo "Në rregull"', () => {
  const d = require('dayjs')('2026-07-20');
  // Kestet e vitit te fundit kane afate PAS dates se diplomimit
  const insts = [
    { seq: 1, due_date: '2026-09-06', amount: 765, generation: '2025/2026' },
    { seq: 2, due_date: '2027-01-25', amount: 765, generation: '2025/2026' },
  ];
  const base = {
    generation: '2025/2026', yearly_quota: 1530,
    discount_type: 'none', discount_value: 0, settled_paid: 0,
  };

  const grad = summarizeFinance({ ...base, status: 'graduated' }, insts, 127.5, d);
  assert.equal(grad.status, 'overdue');
  assert.equal(grad.balance, 1402.5);
  // edhe rreshtat e kesteve shfaqen te vonuar, qe tabela te mos e kundershtoje shenjen
  assert.ok(grad.installments.every((i) => i.status === 'overdue'));

  // i shlyer plotesisht mbetet 'paid'
  assert.equal(summarizeFinance({ ...base, status: 'graduated' }, insts, 1530, d).status, 'paid');

  // nxenesi AKTIV me te njejtat keste nuk preket
  assert.equal(summarizeFinance({ ...base, status: 'active' }, insts, 127.5, d).status, 'ok');
});

test('rikujtesa lejohet vetëm për Vonesë dhe Afër afatit', () => {
  // e njejta logjike si canRemind() te frontend/src/utils/reminder.js
  const canRemind = (f) => f && (f.status === 'overdue' || f.status === 'due-soon');
  assert.equal(canRemind({ status: 'overdue' }), true);
  assert.equal(canRemind({ status: 'due-soon' }), true);
  assert.equal(canRemind({ status: 'ok' }), false);
  assert.equal(canRemind({ status: 'paid' }), false);
  assert.equal(canRemind(null), null);
});