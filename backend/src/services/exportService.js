const ExcelJS = require('exceljs');
const pool = require('../config/db');
const { httpError } = require('../middleware/errorHandler');
const { computeNetQuota } = require('../utils/finance');
const SPEC = require('./exportTemplateSpec');

/**
 * Eksporti "Pagesat" në Excel — një libër pune për një gjeneratë,
 * me nga një fletë për çdo drejtim, në formatin e saktë të shkollës.
 *
 * Struktura e çdo flete (e nxjerrë nga shablloni origjinal):
 *   A=Nr.  B=Emri dhe mbiemri  C=Koment  D=Totali  E=Paguar  F=Borxhi
 *   pastaj 13 blloqe 4-kolonëshe (Data|Banka|Cash|Vlera):
 *   "Kontakt" + "Kësti 1".."Kësti 12"
 *
 * Rregullat e rëna dakord:
 *   - vetëm nxënësit AKTIVË të gjeneratës, të renditur alfabetikisht
 *   - D = kuota NETO pas zbritjes (+ borxhi i bartur, i shënuar te Koment)
 *   - E = formulë =SUM(...Vlera); F = formulë =-1*(D-E)  (borxhi NEGATIV)
 *   - Cash shënohet me "X"; Banka me emrin e shkurtër
 *   - fleta mbaron te nxënësi i fundit; rreshti i totalit vetëm F=SUM(...)
 */

// Rendi i fletëve: i pari sipas preferencës së shkollës, të tjerët alfabetikisht
const SHEET_ORDER = ['TD', 'BPI', 'AF', 'TF', 'TIK'];

// Blloqet: Kontakt (bartja nga viti i kaluar) + Kësti 1..12
const BLOCKS = 13;
const FIRST_BLOCK_COL = 7; // G
const MONEY_FMT = '#,##0.00\\ [$€-1]';
const DATE_FMT = 'dd.mm.yyyy';

/**
 * Emri i shkurtër i bankës për kolonën "Banka":
 *   "TEB Bank" -> "TEB", "NLB Banka" -> "NLB", "RBKO" -> "RBKO".
 * Kur edhe pas heqjes së fjalës "bankë" emri mbetet i gjatë, ndërtohet
 * akronimi nga shkronjat e para të fjalëve origjinale — kështu
 * "Banka për Biznes" bëhet "BpB" dhe "Banka Kombëtare Tregtare" "BKT".
 */
function bankShortName(name) {
  const original = String(name || '').trim();
  const stripped = original
    .replace(/\b(banka|bankë|banke|bank)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  // nje fjale e shkurter: perdoret vete ("TEB", "RBKO", "ProCredit")
  if (stripped && stripped.length <= 10 && !stripped.includes(' ')) return stripped;
  // shumefjaleshe ose e gjate: akronimi i emrit origjinal ("BpB", "BKT")
  const acronym = original.split(/\s+/).map((w) => w[0]).join('');
  return acronym || original.slice(0, 10);
}

/**
 * Shpërndarja e pagesave mbi këstet, pagesë-pas-pagese (FIFO), njësoj si
 * llogaritja e aplikacionit — që E dhe F të përputhen me bilancin real.
 *
 * `settled` (settled_paid) është pjesa e pagesave të konsumuara nga këste
 * të hequra gjatë kalimit të vitit: digjet nga pagesat më të hershme përpara
 * se pjesa tjetër të derdhet mbi këstet aktuale.
 *
 * Kthen për çdo këst: { paid, last: {date, method, bank} | null }
 */
function allocateDetailed(installments, payments, settled) {
  const slots = installments.map((i) => ({
    seq: i.is_carryover ? 0 : i.seq,
    amount: Number(i.amount),
    paid: 0,
    last: null,
  }));
  slots.sort((a, b) => a.seq - b.seq);

  let burn = Math.max(Number(settled) || 0, 0);
  let idx = 0;

  for (const p of payments) {
    let left = Number(p.amount);
    if (burn > 0) {
      const b = Math.min(burn, left);
      burn -= b;
      left -= b;
    }
    while (left > 0.004 && idx < slots.length) {
      const s = slots[idx];
      const room = s.amount - s.paid;
      if (room <= 0.004) { idx += 1; continue; }
      const take = Math.min(room, left);
      s.paid = Math.round((s.paid + take) * 100) / 100;
      s.last = { date: p.payment_date, method: p.method, bank: p.bank_name };
      left = Math.round((left - take) * 100) / 100;
    }
    // pagesat përtej planit (mbipagesë) nuk kanë kolonë — mbeten jashtë fletës
  }
  return slots;
}

// ---------------------------------------------------------------
//  Stilizimi sipas specifikimit të nxjerrë nga shablloni
// ---------------------------------------------------------------

function applySpecStyle(cell, s) {
  if (!s) return;
  cell.font = {
    name: 'Calibri',
    size: s.f ? s.f[0] : 14,
    bold: s.f ? Boolean(s.f[1]) : false,
  };
  if (s.bg) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + s.bg } };
  }
  if (s.b) {
    const border = {};
    for (const side of ['left', 'right', 'top', 'bottom']) {
      if (s.b[side]) border[side] = { style: s.b[side] };
    }
    cell.border = border;
  }
  if (s.a) {
    cell.alignment = {
      horizontal: s.a[0] || undefined,
      vertical: s.a[1] || undefined,
      wrapText: Boolean(s.a[2]),
    };
  }
  if (s.n) cell.numFmt = s.n;
}

function colLetter(n) {
  let s = '';
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Qelizat "Vlera" të një rreshti: J, N, R, ... BF */
function vleraRefs(row) {
  const refs = [];
  for (let b = 0; b < BLOCKS; b += 1) {
    refs.push(colLetter(FIRST_BLOCK_COL + b * 4 + 3) + row);
  }
  return refs;
}

function buildSheet(wb, code, generationLabel, students) {
  const ws = wb.addWorksheet(code, {
    views: [{ state: 'frozen', xSplit: 6, ySplit: 3 }],
  });

  // gjerësitë e kolonave — saktësisht si shablloni
  for (const [letter, width] of Object.entries(SPEC.widths)) {
    ws.getColumn(letter).width = width;
  }

  // rreshtat 1-3: vlera + stile nga specifikimi
  ws.getCell('B1').value = `Gjenerata ${generationLabel}`;
  ws.getCell('A2').value = 'Nr.';
  const GROUP_TITLES = ['Kontakt', ...Array.from({ length: 12 }, (_, i) => `Kësti ${i + 1}`)];
  const COL_TITLES = ['Data', 'Banka', 'Cash', 'Vlera'];
  for (let b = 0; b < BLOCKS; b += 1) {
    const start = FIRST_BLOCK_COL + b * 4;
    ws.getCell(2, start).value = GROUP_TITLES[b];
    for (let i = 0; i < 4; i += 1) ws.getCell(3, start + i).value = COL_TITLES[i];
  }
  ['Emri dhe mbiemri', 'Koment', 'Totali', 'Paguar', 'Borxhi'].forEach((t, i) => {
    ws.getCell(3, 2 + i).value = t;
  });

  for (const r of [1, 2, 3]) {
    const spec = SPEC[`r${r}`];
    for (const [letter, s] of Object.entries(spec)) applySpecStyle(ws.getCell(`${letter}${r}`), s);
    ws.getRow(r).height = SPEC.heights[r];
  }
  for (const rng of SPEC.merges) ws.mergeCells(rng);

  // ---- rreshtat e nxënësve ----
  let row = 4;
  for (const st of students) {
    const banded = SPEC[(row - 4) % 2 === 0 ? 'r4' : 'r5']; // tek/çift si shablloni
    for (let c = 1; c <= 58; c += 1) {
      const letter = colLetter(c);
      applySpecStyle(ws.getCell(row, c), banded[letter]);
    }
    ws.getRow(row).height = SPEC.heights[4];

    const carryover = st.installments
      .filter((i) => i.is_carryover)
      .reduce((a, i) => a + Number(i.amount), 0);
    const netQuota = computeNetQuota(st.yearly_quota, st.discount_type, st.discount_value);
    const totali = Math.round((netQuota + carryover) * 100) / 100;

    ws.getCell(row, 1).value = row - 3;
    ws.getCell(row, 2).value = `${st.first_name} ${st.last_name}`;
    if (carryover > 0) {
      ws.getCell(row, 3).value = `Bartur nga viti i kaluar: ${carryover.toFixed(2).replace('.', ',')} €`;
    }
    ws.getCell(row, 4).value = totali;
    ws.getCell(row, 5).value = { formula: `SUM(${vleraRefs(row).join(',')})` };
    ws.getCell(row, 6).value = { formula: `-1*(D${row}-E${row})` };

    // blloqet: Kontakt merr bartjen (seq 0), Kësti i merr këstin i
    const slots = allocateDetailed(st.installments, st.payments, st.settled_paid);
    for (const slot of slots) {
      if (slot.seq > 12 || slot.paid <= 0.004 || !slot.last) continue;
      const start = FIRST_BLOCK_COL + slot.seq * 4;
      const dCell = ws.getCell(row, start);
      dCell.value = new Date(slot.last.date);
      dCell.numFmt = DATE_FMT;
      if (slot.last.method === 'cash') {
        ws.getCell(row, start + 2).value = 'X';
      } else {
        ws.getCell(row, start + 1).value = bankShortName(slot.last.bank);
      }
      const vCell = ws.getCell(row, start + 3);
      vCell.value = slot.paid;
      vCell.numFmt = MONEY_FMT;
    }
    row += 1;
  }

  // ---- rreshti i totalit: vetëm F, si shablloni ----
  const lastData = row - 1;
  if (students.length) {
    const total = ws.getCell(row, 6);
    total.value = { formula: `SUM(F4:F${lastData})` };
    applySpecStyle(total, SPEC.total_F);
  }

  ws.autoFilter = { from: 'A3', to: `BG${students.length ? row : 3}` };

  // Banka dhe Cash përjashtojnë njëra-tjetrën — si te shablloni origjinal.
  // SHËNIM: vendoset qelizë-për-qelizë sepse `dataValidations.add` me
  // diapazon e rrëzon optimizuesin e ExcelJS ("marked" mbi undefined);
  // optimizuesi i bashkon vetë qelizat fqinje kur shkruan skedarin.
  if (students.length) {
    for (let b = 0; b < BLOCKS; b += 1) {
      const bankCol = FIRST_BLOCK_COL + b * 4 + 1;
      const cashCol = bankCol + 1;
      const bank = colLetter(bankCol);
      const cash = colLetter(cashCol);
      for (let r = 4; r <= lastData; r += 1) {
        ws.getCell(r, bankCol).dataValidation = {
          type: 'custom', allowBlank: true, formulae: [`=ISBLANK(${cash}${r})`],
          showErrorMessage: true, error: 'Zgjidhni Bankën OSE Cash, jo të dyja.',
        };
        ws.getCell(r, cashCol).dataValidation = {
          type: 'custom', allowBlank: true, formulae: [`=ISBLANK(${bank}${r})`],
          showErrorMessage: true, error: 'Zgjidhni Bankën OSE Cash, jo të dyja.',
        };
      }
    }
  }

  return ws;
}

/** "2025/2026" -> etiketa e shkurtër "2025/26" si te shablloni */
function shortGeneration(generation) {
  const m = String(generation).match(/^(\d{4})\/(\d{4})$/);
  return m ? `${m[1]}/${m[2].slice(-2)}` : generation;
}

async function buildFinanceWorkbook(generation) {
  if (!/^\d{4}\/\d{4}$/.test(String(generation || ''))) {
    throw httpError(400, 'Gjenerata duhet të jetë në formatin 2025/2026.');
  }

  const [categories] = await pool.query('SELECT id, code, name FROM categories');
  categories.sort((a, b) => {
    const ia = SHEET_ORDER.indexOf(a.code); const ib = SHEET_ORDER.indexOf(b.code);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.code.localeCompare(b.code);
  });

  const [students] = await pool.query(
    `SELECT s.*, c.code AS category_code
       FROM students s JOIN categories c ON c.id = s.category_id
      WHERE s.status = 'active' AND s.generation = ?
      ORDER BY s.last_name, s.first_name`,
    [generation]
  );

  const ids = students.map((s) => s.id);
  let instByStudent = {}; let payByStudent = {};
  if (ids.length) {
    const [insts] = await pool.query(
      'SELECT * FROM installments WHERE student_id IN (?) ORDER BY seq', [ids]
    );
    const [pays] = await pool.query(
      `SELECT p.student_id, p.amount, p.payment_date, p.method, b.name AS bank_name
         FROM payments p LEFT JOIN banks b ON b.id = p.bank_id
        WHERE p.student_id IN (?)
        ORDER BY p.payment_date, p.id`,
      [ids]
    );
    for (const i of insts) (instByStudent[i.student_id] ||= []).push(i);
    for (const p of pays) (payByStudent[p.student_id] ||= []).push(p);
  }
  for (const s of students) {
    s.installments = instByStudent[s.id] || [];
    s.payments = payByStudent[s.id] || [];
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'ISPE';
  const label = shortGeneration(generation);
  for (const cat of categories) {
    buildSheet(wb, cat.code, label, students.filter((s) => s.category_id === cat.id));
  }

  return { workbook: wb, filename: `ISPE_Pagesat_${generation.replace('/', '-')}.xlsx` };
}

module.exports = { buildFinanceWorkbook, bankShortName, allocateDetailed, SHEET_ORDER };