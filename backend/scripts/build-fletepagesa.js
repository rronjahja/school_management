/**
 * Gjeneron shabllonin templates/Fletepagesa.docx.
 *
 * Nuk ekzekutohet nga aplikacioni — përdoret vetëm kur duam të ndryshojmë
 * pamjen e fletëpagesës. Dokumenti i gjeneruar ruhet në repo, prandaj
 * serveri nuk ka nevojë për paketën 'docx'.
 *
 *   cd backend
 *   npm install --save-dev docx      # një herë
 *   node scripts/build-fletepagesa.js
 *
 * Etiketat nuk duhen ndryshuar pa përditësuar buildFletepagesa()
 * te src/services/documentService.js.
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, VerticalAlign,
} = require('docx');

// ── Faqja ──────────────────────────────────────────────────────
const PAGE_W = 11906;   // A4
const PAGE_H = 16838;
const MARGIN = 700;
const TOP_MARGIN = Number(process.env.TOPM || 2070);
const W = PAGE_W - MARGIN * 2;
const HALF = Math.floor(W / 2);

// ── Ngjyrat ────────────────────────────────────────────────────
// Vetëm e zezë dhe gri për tekst; asnjë mbushje askund.
const MONO = process.env.MONO !== '0';
const INK = MONO ? '000000' : '1B2A41';
const MUTED = MONO ? '5A5A5A' : '6B7789';

// ── Vijat: NJË trashësi e vetme kudo ───────────────────────────
const RULE_SZ = Number(process.env.RULE || 4);   // 0.5pt
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const rule = () => ({ style: BorderStyle.SINGLE, size: RULE_SZ, color: INK });

/**
 * Kthen VETËM anët e kërkuara. Nëse do të vendosnim 'none' te të tjerat,
 * do të mbishkruanin kornizën e tabelës — qeliza ka përparësi ndaj saj
 * dhe korniza e jashtme do të zhdukej.
 */
const R = (...sides) => {
  const b = {};
  sides.forEach((s) => { b[s] = rule(); });
  return b;
};

// ── Tipografia ─────────────────────────────────────────────────
// BUMP i shtohet ÇDO madhësie (në gjysmë-pika: 8 = +4pt). Meqë shtohet
// dhe nuk shumëzohet, teksti i vogël fiton më shumë — pikërisht ai që
// lexohej me vështirësi. 'raw' e përjashton (p.sh. rreshtat ndihmës).
const BUMP = Number(process.env.BUMP || 8);

const t = (text, o = {}) => new TextRun({
  text,
  font: 'Calibri',
  size: o.raw ? (o.size || 20) : (o.size || 20) + BUMP,
  bold: o.bold || false,
  color: o.color || INK,
  characterSpacing: o.sp || 0,
});

const p = (runs, o = {}) => new Paragraph({
  children: Array.isArray(runs) ? runs : [runs],
  alignment: o.align,
  spacing: { before: o.before || 0, after: o.after || 0, line: o.line || 240 },
  border: o.border,
});

/** Etiketë e vogël me shkronja kapitale — jep hierarki pa mbushje. */
const label = (text, o = {}) =>
  p(t(text, { size: 13, color: MUTED, sp: 28, bold: true }), o);

// Shkalla e hapësirave — rregullohet që dy fletët të zënë saktësisht një faqe
const PAD = Number(process.env.PAD || 0.6);

const cell = (children, o = {}) => new TableCell({
  children,
  width: { size: o.w, type: WidthType.DXA },
  columnSpan: o.span,
  borders: o.borders,                       // pa borders → trashëgon kornizën
  margins: {
    top: Math.round((o.mt ?? 150) * PAD), bottom: Math.round((o.mb ?? 150) * PAD),
    left: o.ml ?? 220, right: o.mr ?? 220,
  },
  verticalAlign: o.va || VerticalAlign.TOP,
});

/** Tabelë e brendshme: pa kufij të vetët, vetëm ata që i japim qelizave. */
const inner = (rows, widths) => new Table({
  rows,
  columnWidths: widths,
  width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
  borders: {
    top: NONE, bottom: NONE, left: NONE, right: NONE,
    insideHorizontal: NONE, insideVertical: NONE,
  },
});

// ═══════════════════════════════════════════════════════════════
//  Një gjysmë e fletës
// ═══════════════════════════════════════════════════════════════
function slip() {
  const rows = [];

  // ── 1. Koka: institucioni majtas, lloji i dokumentit djathtas ──
  rows.push(new TableRow({
    children: [
      cell([
        p(t('KOLEGJI ISPE', { size: 32, bold: true, sp: 16 }), { after: 60 }),
        p(t('Rr. Enver Maloku, Nr. 49, 10000 Prishtinë', { size: 15, color: MUTED })),
      ], { w: HALF, mt: 230, mb: 200 }),
      cell([
        p(t('FLETËPAGESË', { size: 22, bold: true, sp: 40 }),
          { align: AlignmentType.RIGHT, after: 60 }),
        p(t('{data_sotme}', { size: 17, color: MUTED }), { align: AlignmentType.RIGHT }),
      ], { w: W - HALF, mt: 230, mb: 200 }),
    ],
  }));

  // ── 2. Paguesi majtas, llogaritë bankare djathtas ──
  const bankLine = (name, nr) => p([
    t(name.padEnd(6), { size: 17, bold: true }),
    t('  ' + nr, { size: 17 }),
  ], { after: 70 });

  rows.push(new TableRow({
    children: [
      cell([
        label('PAGUESI', { after: 110 }),
        p(t('{emri_nxenesit} {mbiemri_nxenesit}', { size: 24, bold: true }), { after: 90 }),
        p([t('Prindi:  ', { size: 16, color: MUTED }), t('{emri_babait}', { size: 16 })],
          { after: 55 }),
        p([t('Nr. ID:  ', { size: 16, color: MUTED }), t('{nr_kontrates}', { size: 16 })]),
      ], { w: HALF, mt: 200, mb: 200, borders: R('top') }),
      cell([
        label('LLOGARITË BANKARE', { after: 110 }),
        bankLine('TEB', '2011 0000 2024 7044'),
        bankLine('RBKO', '1501 1500 0091 7205'),
        p(t('Kolegji ISPE Sh.P.K · NUI 810800921', { size: 14, color: MUTED }),
          { before: 40 }),
      ], { w: W - HALF, mt: 200, mb: 200, borders: R('top', 'left') }),
    ],
  }));

  // ── 3. Përshkrimi i pagesës ──
  rows.push(new TableRow({
    children: [
      cell([
        label('PËRSHKRIMI I PAGESËS', { after: 100 }),
        p(t('{pershkrimi_pageses}', { size: 20 })),
      ], { w: W, span: 2, mt: 190, mb: 190, borders: R('top') }),
    ],
  }));

  // ── 4. Shuma — pika ku bie syri ──
  rows.push(new TableRow({
    children: [
      cell([
        label('SHUMA PËR PAGESË', { after: 60 }),
      ], { w: HALF, mt: 210, mb: 210, va: VerticalAlign.CENTER, borders: R('top') }),
      cell([
        p([t('{shuma}', { size: 44, bold: true }), t('  €', { size: 26, bold: true })],
          { align: AlignmentType.RIGHT }),
      ], { w: W - HALF, mt: 190, mb: 190, va: VerticalAlign.CENTER, borders: R('top') }),
    ],
  }));

  // ── 5. Gjendja financiare: totali · paguar · mbetur ──
  const money = (lbl, tag, o = {}) => cell([
    p(t(lbl, { size: 13, color: MUTED, sp: 24, bold: true }), { after: 70 }),
    p([t(tag, { size: 21, bold: o.bold !== false }), t(' €', { size: 15 })]),
  ], { w: o.w, mt: 150, mb: 150, borders: o.borders });

  const third = Math.floor(W / 3);
  rows.push(new TableRow({
    children: [
      cell([inner([new TableRow({
        children: [
          money('TOTALI', '{totali}', { w: third }),
          money('PAGUAR DERI TANI', '{paguar}', { w: third, borders: R('left') }),
          money('PJESA E MBETUR', '{mbetur}', { w: W - 2 * third, borders: R('left') }),
        ],
      })], [third, third, W - 2 * third])],
      { w: W, span: 2, ml: 0, mr: 0, mt: 0, mb: 0, borders: R('top') }),
    ],
  }));

  // ── 6. Nënshkrimet ──
  const sign = (lbl, w, o = {}) => cell([
    p(t(''), { after: 260 }),
    p(t('', { size: 2, raw: true }), {
      border: { bottom: { style: BorderStyle.SINGLE, size: RULE_SZ, color: INK, space: 2 } },
      after: 70,
    }),
    p(t(lbl, { size: 14, color: MUTED })),
  ], { w, mt: 150, mb: 150, ...o });

  rows.push(new TableRow({
    children: [
      cell([inner([new TableRow({
        children: [
          sign('Nënshkrimi i paguesit', HALF, { ml: 220, mr: 400 }),
          sign('Arkëtoi / Vula', W - HALF, { ml: 400, mr: 220 }),
        ],
      })], [HALF, W - HALF])],
      { w: W, span: 2, ml: 0, mr: 0, mt: 0, mb: 0, borders: R('top') }),
    ],
  }));

  // korniza e jashtme — e vetmja tabelë me kufij
  return new Table({
    rows,
    columnWidths: [HALF, W - HALF],
    width: { size: W, type: WidthType.DXA },
    borders: {
      top: rule(), bottom: rule(), left: rule(), right: rule(),
      insideHorizontal: NONE, insideVertical: NONE,
    },
  });
}

// ── Vija e prerjes ─────────────────────────────────────────────
// Simboli ✂ vizatohet si emoji me NGJYRA nga shumë fonte — në printer
// bardhezi del njollë. Prandaj përdoret tekst i thjeshtë.
const GAP = 420;
const cutLine = () => [
  p(t(''), { after: GAP }),
  p([
    t('– '.repeat(26), { size: 15, color: MUTED }),
    t('  PRISNI KËTU  ', { size: 13, bold: true, color: MUTED, sp: 30 }),
    t('– '.repeat(26), { size: 15, color: MUTED }),
  ], { after: GAP, align: AlignmentType.CENTER }),
];

const doc = new Document({
  styles: { default: { document: { run: { font: 'Calibri', size: 20, color: INK } } } },
  sections: [{
    properties: {
      page: {
        size: { width: PAGE_W, height: PAGE_H },
        margin: { top: TOP_MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
      },
    },
    children: [
      slip(),
      ...cutLine(),
      slip(),
    ],
  }],
});

const OUT = process.env.OUT || path.join(__dirname, '..', 'templates', 'Fletepagesa.docx');

Packer.toBuffer(doc).then((buf) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, buf);
  console.log(`u shkrua ${OUT}  |  ${buf.length} bajt`);
});