/**
 * Riparimi i kësteve që nuk përputhen me kuotën e nxënësit.
 *
 * PSE NUK BËHET ME SQL: datat e kësteve varen nga plani i pagesës dhe nga
 * kalendari i vitit shkollor (Neni 6 i kontratës). Ato i di vetëm
 * `buildInstallments`. Prandaj riparimi kalon nga i njëjti kod që përdor
 * aplikacioni — jo nga një formulë e shkruar dy herë.
 *
 * ÇFARË PREK:
 *   · vetëm nxënësit AKTIVË
 *   · vetëm këstet e vitit shkollor AKTUAL të nxënësit
 *   · rreshti «Borxhi i vitit të kaluar» (is_carryover = 1) NUK preket kurrë
 *   · asnjë pagesë nuk preket kurrë
 *
 * PËRDORIMI:
 *   node scripts/repair-installments.js            # parapamje, s'ndryshon asgjë
 *   node scripts/repair-installments.js --apply    # ndreqja e vërtetë
 *   node scripts/repair-installments.js --apply --id=42,57
 *
 * Bëni një kopje rezervë të bazës para se ta ekzekutoni me --apply.
 */

const pool = require('../src/config/db');
const { computeNetQuota, buildInstallments, round2 } = require('../src/utils/finance');

const APPLY = process.argv.includes('--apply');
const idArg = process.argv.find((a) => a.startsWith('--id='));
const ONLY_IDS = idArg
  ? idArg.slice(5).split(',').map((n) => Number(n.trim())).filter(Boolean)
  : null;

const eur = (n) => `${Number(n).toFixed(2)} €`;

async function main() {
  const [students] = await pool.query(
    `SELECT id, first_name, last_name, generation, study_year, payment_plan,
            enrollment_date, yearly_quota, discount_type, discount_value
       FROM students
      WHERE status = 'active'
      ORDER BY last_name, first_name`
  );

  const targets = ONLY_IDS
    ? students.filter((s) => ONLY_IDS.includes(s.id))
    : students;

  const broken = [];

  for (const s of targets) {
    // Vetëm këstet e vitit AKTUAL: vitet e kaluara dhe borxhi i bartur
    // janë histori dhe nuk rillogariten.
    const [current] = await pool.query(
      `SELECT id, seq, due_date, amount
         FROM installments
        WHERE student_id = ? AND generation = ? AND is_carryover = 0
        ORDER BY seq`,
      [s.id, s.generation]
    );
    if (!current.length) continue;

    const net = computeNetQuota(s.yearly_quota, s.discount_type, s.discount_value);
    const have = round2(current.reduce((a, i) => a + Number(i.amount), 0));

    if (Math.abs(have - net) <= 0.01) continue;

    broken.push({ student: s, current, net, have });
  }

  if (!broken.length) {
    console.log('Asnjë mospërputhje. Këstet përputhen me kuotat.');
    return;
  }

  console.log(`\n${broken.length} nxënës me këste që s'përputhen me kuotën:\n`);

  for (const b of broken) {
    const { student: s, current, net, have } = b;
    console.log(
      `#${s.id}  ${s.first_name} ${s.last_name}  (${s.generation}, viti ${s.study_year}, ${s.payment_plan})`
    );
    console.log(
      `      kuota ${eur(s.yearly_quota)} · zbritje ${s.discount_type}=${s.discount_value}`
      + ` -> duhet ${eur(net)} · ka ${eur(have)} · ndryshimi ${eur(net - have)}`
    );

    const fresh = buildInstallments(net, s.payment_plan, s.enrollment_date, s.generation);

    if (!APPLY) {
      console.log(`      këstet e reja: ${fresh.map((i) => `${i.seq}) ${i.due_date} ${eur(i.amount)}`).join('  ')}`);
      console.log('');
      continue;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        'DELETE FROM installments WHERE student_id = ? AND generation = ? AND is_carryover = 0',
        [s.id, s.generation]
      );

      // Numërimi vazhdon pas atyre që mbeten (p.sh. borxhi i bartur ka seq 0).
      const [[mx]] = await conn.query(
        'SELECT COALESCE(MAX(seq), 0) AS m FROM installments WHERE student_id = ?',
        [s.id]
      );
      const offset = Number(mx.m);

      await conn.query(
        'INSERT INTO installments (student_id, generation, seq, due_date, amount) VALUES ?',
        [fresh.map((i) => [s.id, s.generation, offset + i.seq, i.due_date, i.amount])]
      );

      await conn.commit();
      console.log('      ✓ u ndreq\n');
    } catch (err) {
      await conn.rollback();
      console.error(`      ✗ dështoi: ${err.message}\n`);
    } finally {
      conn.release();
    }
  }

  if (!APPLY) {
    console.log('Parapamje — asgjë nuk u ndryshua.');
    console.log('Për ta zbatuar:  node scripts/repair-installments.js --apply');
  }
}

main()
  .catch((err) => {
    console.error('Gabim:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());