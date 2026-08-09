import { jsPDF } from 'jspdf';
import { SCHOOL } from '../config/school';
import { classLabel, YEAR_LABELS, PLAN_LABELS, discountText } from './format';

/**
 * Raporti i pagesave të një nxënësi, si PDF.
 *
 * Vizatohet drejtpërdrejt me jsPDF, jo si fotografi e ekranit: teksti
 * mbetet tekst — kërkohet, kopjohet dhe shtypet i qartë në çdo madhësi,
 * kurse skeda mbetet nën 100 KB. Një tabelë pagesash e kthyer në pamje
 * do të dilte e turbullt dhe do të pritej keq mes faqeve.
 *
 * Fontet e brendshme të jsPDF-së (Helvetica) e mbulojnë Latin-1, ku
 * bëjnë pjesë ë, ç, Ë, Ç — pra shqipja del si duhet pa font shtesë.
 */

// ---- Përmasat e faqes (mm) ----
const A4 = { w: 210, h: 297 };
const M = { left: 15, right: 15, top: 16, bottom: 18 };
const CONTENT_W = A4.w - M.left - M.right;

// ---- Ngjyrat ----
const INK = [26, 32, 44];
const SOFT = [107, 114, 128];
const LINE = [214, 219, 227];
const BRAND = [29, 63, 158];
const GREEN = [22, 122, 74];
const RED = [176, 32, 39];
const AMBER = [154, 106, 0];
const BAND = [246, 248, 252];

const eur = (n) => `${(Number(n) || 0).toLocaleString('de-DE', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})} €`;

const dmy = (d) => {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return day ? `${day}/${m}/${y}` : s;
};

const hm = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
};

const METHOD = { cash: 'Kesh', bank: 'Bankë' };

const INST_STATUS = {
  paid: { label: 'E paguar', color: GREEN },
  overdue: { label: 'E vonuar', color: RED },
  'due-soon': { label: 'Afër afatit', color: AMBER },
  upcoming: { label: 'Në pritje', color: SOFT },
};

export function paymentReportFilename(student) {
  const name = `${student.first_name}-${student.last_name}`
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '');
  return `Raporti-pagesave-${name}.pdf`;
}

export function buildPaymentReport(student) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const fin = student.finance || {};
  const payments = student.payments || [];
  const installments = fin.installments || [];

  let y = M.top;

  // Numri i faqes shkruhet në fund, kur dihet sa faqe dolën gjithsej
  const footers = [];

  const setFont = (size, style = 'normal', color = INK) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const line = (yy, color = LINE, width = 0.2) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(M.left, yy, A4.w - M.right, yy);
  };

  /** Kalon në faqe të re nëse s'ka më vend për `need` mm. */
  const room = (need) => {
    if (y + need <= A4.h - M.bottom) return;
    footers.push(doc.getNumberOfPages());
    doc.addPage();
    y = M.top;
  };

  // ---------------- Kreu ----------------
  setFont(16, 'bold', BRAND);
  doc.text(SCHOOL.name, M.left, y);
  setFont(9, 'normal', SOFT);
  doc.text(`${SCHOOL.phone}  ·  ${SCHOOL.email}`, M.left, y + 4.5);

  setFont(13, 'bold', INK);
  doc.text('Raporti i pagesave', A4.w - M.right, y, { align: 'right' });
  setFont(8.5, 'normal', SOFT);
  doc.text(`Lëshuar më ${dmy(new Date().toISOString())}`, A4.w - M.right, y + 4.5,
    { align: 'right' });

  y += 9;
  line(y, BRAND, 0.6);
  y += 7;

  // ---------------- Nxënësi ----------------
  setFont(14, 'bold', INK);
  doc.text(`${student.first_name} ${student.last_name}`, M.left, y);
  y += 5.5;

  const meta = [
    ['Drejtimi', student.category_name || '—'],
    ['Viti / paralelja', `${YEAR_LABELS[student.study_year] || '—'}${
      student.class_name ? ` · ${classLabel(student.study_year, student.class_name)}` : ''}`],
    ['Gjenerata', student.generation || '—'],
    ['Nr. i kontratës', student.contract_number || '—'],
    ['Plani i pagesës', PLAN_LABELS[student.payment_plan] || student.payment_plan || '—'],
    ['Zbritja', discountText(student.discount_type, student.discount_value) || 'Pa zbritje'],
  ];

  setFont(9);
  const colW = CONTENT_W / 3;
  meta.forEach(([label, value], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = M.left + col * colW;
    const yy = y + row * 9;
    setFont(7.5, 'normal', SOFT);
    doc.text(String(label).toUpperCase(), x, yy);
    setFont(9.5, 'bold', INK);
    doc.text(String(value), x, yy + 4);
  });
  y += Math.ceil(meta.length / 3) * 9 + 3;

  // ---------------- Përmbledhja ----------------
  const cards = [
    ['Detyrimi total', eur(fin.total_due), INK],
    ['Paguar', eur(fin.total_paid), GREEN],
    ['Mbetur', eur(fin.balance), Number(fin.balance) > 0.009 ? RED : GREEN],
  ];

  const cardW = (CONTENT_W - 8) / 3;
  cards.forEach(([label, value, color], i) => {
    const x = M.left + i * (cardW + 4);
    doc.setFillColor(...BAND);
    doc.setDrawColor(...LINE);
    doc.roundedRect(x, y, cardW, 16, 1.6, 1.6, 'FD');
    setFont(7.5, 'normal', SOFT);
    doc.text(String(label).toUpperCase(), x + 4, y + 5.5);
    setFont(13, 'bold', color);
    doc.text(String(value), x + 4, y + 12.5);
  });
  y += 22;

  // Borxhi i bartur, nëse ka — përndryshe shifrat më sipër duken të pashpjegueshme
  if (Number(fin.past_years_balance) > 0.009) {
    setFont(9, 'normal', AMBER);
    doc.text(
      `Prej shumës së mbetur, ${eur(fin.past_years_balance)} është borxh i bartur nga vitet e kaluara.`,
      M.left, y
    );
    y += 6;
  }

  // ---------------- Këstet ----------------
  room(30);
  setFont(11, 'bold', INK);
  doc.text('Këstet', M.left, y);
  setFont(8.5, 'normal', SOFT);
  doc.text(`${installments.filter((i) => i.status === 'paid').length} nga ${installments.length} të mbyllura`,
    A4.w - M.right, y, { align: 'right' });
  y += 4;

  const iCols = [
    { key: 'seq', label: 'Nr.', w: 12, align: 'left' },
    { key: 'due', label: 'Afati', w: 26, align: 'left' },
    { key: 'label', label: 'Përshkrimi', w: 62, align: 'left' },
    { key: 'amount', label: 'Shuma', w: 26, align: 'right' },
    { key: 'paid', label: 'Paguar', w: 26, align: 'right' },
    { key: 'status', label: 'Gjendja', w: 28, align: 'right' },
  ];

  const drawHead = (cols) => {
    doc.setFillColor(...BAND);
    doc.rect(M.left, y, CONTENT_W, 7, 'F');
    setFont(7.5, 'bold', SOFT);
    let x = M.left + 2;
    for (const c of cols) {
      doc.text(c.label.toUpperCase(), c.align === 'right' ? x + c.w - 4 : x, y + 4.6,
        { align: c.align });
      x += c.w;
    }
    y += 7;
  };

  drawHead(iCols);

  installments.forEach((inst, idx) => {
    room(8);
    if (y === M.top) drawHead(iCols);
    if (idx % 2 === 1) {
      doc.setFillColor(250, 251, 253);
      doc.rect(M.left, y, CONTENT_W, 7, 'F');
    }
    const st = INST_STATUS[inst.status] || INST_STATUS.upcoming;
    const cells = [
      String(inst.seq ?? idx + 1),
      dmy(inst.due_date),
      inst.is_carryover ? 'Borxhi i vitit të kaluar' : (inst.label || 'Këst'),
      eur(inst.amount),
      eur(inst.paid || 0),
      st.label,
    ];
    let x = M.left + 2;
    iCols.forEach((c, i) => {
      setFont(8.5, i === 5 ? 'bold' : 'normal', i === 5 ? st.color : INK);
      const text = doc.splitTextToSize(cells[i], c.w - 4)[0] || '';
      doc.text(text, c.align === 'right' ? x + c.w - 4 : x, y + 4.7, { align: c.align });
      x += c.w;
    });
    y += 7;
    line(y);
  });

  if (installments.length === 0) {
    setFont(9, 'italic', SOFT);
    doc.text('Nuk ka këste të gjeneruara.', M.left + 2, y + 5);
    y += 9;
  }

  y += 8;

  // ---------------- Pagesat ----------------
  room(30);
  setFont(11, 'bold', INK);
  doc.text('Pagesat e kryera', M.left, y);
  setFont(8.5, 'normal', SOFT);
  doc.text(`${payments.length} pagesa · ${eur(payments.reduce((a, p) => a + Number(p.amount), 0))}`,
    A4.w - M.right, y, { align: 'right' });
  y += 4;

  const pCols = [
    { key: 'date', label: 'Data', w: 24, align: 'left' },
    { key: 'time', label: 'Ora', w: 16, align: 'left' },
    { key: 'method', label: 'Mënyra', w: 24, align: 'left' },
    { key: 'bank', label: 'Banka', w: 36, align: 'left' },
    { key: 'note', label: 'Shënim', w: 54, align: 'left' },
    { key: 'amount', label: 'Shuma', w: 26, align: 'right' },
  ];

  const drawPHead = () => {
    doc.setFillColor(...BAND);
    doc.rect(M.left, y, CONTENT_W, 7, 'F');
    setFont(7.5, 'bold', SOFT);
    let x = M.left + 2;
    for (const c of pCols) {
      doc.text(c.label.toUpperCase(), c.align === 'right' ? x + c.w - 4 : x, y + 4.6,
        { align: c.align });
      x += c.w;
    }
    y += 7;
  };

  drawPHead();

  // Nga më e vjetra te më e reja: raporti lexohet si histori
  const ordered = [...payments].sort(
    (a, b) => String(a.payment_date).localeCompare(String(b.payment_date)) || a.id - b.id
  );

  ordered.forEach((p, idx) => {
    const before = y;
    room(8);
    if (y !== before) drawPHead();
    if (idx % 2 === 1) {
      doc.setFillColor(250, 251, 253);
      doc.rect(M.left, y, CONTENT_W, 7, 'F');
    }
    const cells = [
      dmy(p.payment_date),
      hm(p.created_at),
      METHOD[p.method] || p.method || '—',
      p.method === 'bank' ? (p.bank_name || '—') : '—',
      p.note || '',
      eur(p.amount),
    ];
    let x = M.left + 2;
    pCols.forEach((c, i) => {
      setFont(8.5, i === 5 ? 'bold' : 'normal', i === 5 ? GREEN : INK);
      const text = doc.splitTextToSize(String(cells[i]), c.w - 4)[0] || '';
      doc.text(text, c.align === 'right' ? x + c.w - 4 : x, y + 4.7, { align: c.align });
      x += c.w;
    });
    y += 7;
    line(y);
  });

  if (payments.length === 0) {
    setFont(9, 'italic', SOFT);
    doc.text('Ende nuk është regjistruar asnjë pagesë.', M.left + 2, y + 5);
    y += 9;
  } else {
    // Totali, i theksuar
    doc.setFillColor(...BAND);
    doc.rect(M.left, y, CONTENT_W, 8, 'F');
    setFont(9, 'bold', INK);
    doc.text('Gjithsej të paguara', M.left + 2, y + 5.4);
    setFont(10.5, 'bold', GREEN);
    doc.text(eur(payments.reduce((a, p) => a + Number(p.amount), 0)),
      A4.w - M.right - 2, y + 5.4, { align: 'right' });
    y += 12;
  }

  // Sqarimi kur pagesat e përgjithshme s'përputhen me ato të shpërndara
  if (Number(student.settled_paid) > 0.009) {
    setFont(8, 'italic', SOFT);
    const note = doc.splitTextToSize(
      `Shënim: ${eur(student.settled_paid)} nga pagesat e mësipërme kanë mbyllur këste `
      + 'të viteve të kaluara, të cilat gjatë kalimit të vitit u zëvendësuan me rreshtin '
      + '«Borxhi i vitit të kaluar». Prandaj shuma e pagesave është më e madhe se pjesa '
      + 'e shpërndarë mbi këstet aktuale.',
      CONTENT_W
    );
    room(note.length * 4 + 4);
    doc.text(note, M.left, y);
    y += note.length * 4;
  }

  // ---------------- Fundi i faqeve ----------------
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);
    setFont(7.5, 'normal', SOFT);
    doc.text(
      `${SCHOOL.name} · Raporti i pagesave · ${student.first_name} ${student.last_name}`,
      M.left, A4.h - 10
    );
    doc.text(`Faqja ${i} nga ${total}`, A4.w - M.right, A4.h - 10, { align: 'right' });
  }

  return doc;
}

/** E shkarkon raportin. */
export function downloadPaymentReport(student) {
  buildPaymentReport(student).save(paymentReportFilename(student));
}