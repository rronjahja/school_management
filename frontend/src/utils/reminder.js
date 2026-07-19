import dayjs from 'dayjs';
import { SCHOOL } from '../../config/school';
import { money, date, parallel, shortGen, YEAR_LABELS } from './format';

/** Kontakti i parë prindëror: babai nëse ekziston, përndryshe nëna. */
export function parentContact(s) {
  const father = [s.father_name, s.father_last_name].filter(Boolean).join(' ').trim();
  const mother = [s.mother_name, s.mother_last_name].filter(Boolean).join(' ').trim();
  return father || mother || 'prind/kujdestar';
}

/**
 * Ndërton mesazhin e rikujtesës për një student.
 * `student` duhet të jetë objekti i plotë (me finance.installments).
 */
export function buildReminder(student) {
  const f = student.finance || {};
  const insts = f.installments || [];
  const today = dayjs();

  const overdue = insts.filter((i) => i.status === 'overdue');
  const soon = insts.filter((i) => i.status === 'due-soon');
  const target = overdue.length ? overdue : soon;

  const fullName = `${student.first_name} ${student.last_name}`;
  const yearLabel = YEAR_LABELS[student.study_year] || '';
  const klasa = student.class_name ? `, paralelja ${parallel(student.class_name)}` : '';
  const remaining = (i) => Number(i.amount) - Number(i.paid || 0);

  const lines = [];
  lines.push(`Përshëndetje i/e nderuar ${parentContact(student)},`);
  lines.push('');

  lines.push(
    `Ky është një rikujtesë nga ${SCHOOL.name} për obligimet financiare të ` +
      `nxënësit/es ${fullName}, drejtimi ${student.category_name}` +
      `${yearLabel ? `, ${yearLabel}` : ''}${klasa}, viti shkollor ${shortGen(student.generation)}.`
  );
  lines.push('');

  if (target.length === 1) {
    const i = target[0];
    lines.push(
      overdue.length
        ? `Kësti ${i.seq} në shumën ${money(remaining(i))} ka pasur afat pagese më ` +
            `${date(i.due_date)} dhe ende nuk figuron i paguar.`
        : `Kësti ${i.seq} në shumën ${money(remaining(i))} ka afat pagese më ` +
            `${date(i.due_date)}.`
    );
  } else if (target.length > 1) {
    lines.push(
      overdue.length
        ? 'Këstet e mëposhtme e kanë kaluar afatin e pagesës:'
        : 'Këstet e mëposhtme janë afër afatit të pagesës:'
    );
    target.forEach((i) => {
      lines.push(`  • Kësti ${i.seq} — afati ${date(i.due_date)} — ${money(remaining(i))}`);
    });
    lines.push('');
    lines.push(
      `Totali i ${overdue.length ? 'vonuar' : 'afërt'}: ` +
        money(target.reduce((a, i) => a + remaining(i), 0))
    );
  } else {
    lines.push(`Detyrimi i mbetur deri më sot është ${money(f.balance)}.`);
  }

  if (target.length && Number(f.balance) > 0) {
    lines.push('');
    lines.push(`Borxhi i përgjithshëm deri më sot: ${money(f.balance)}.`);
  }

  if (SCHOOL.banks.length) {
    lines.push('');
    lines.push('Pagesa mund të kryhet përmes llogarive bankare:');
    SCHOOL.banks.forEach((b) => lines.push(`  ${b.name}: ${b.account}`));
  }

  lines.push('');
  lines.push(
    'Nëse pagesa është kryer tashmë, ju lutemi na dërgoni konfirmimin dhe ' +
      'konsiderojeni këtë mesazh të pavlefshëm.'
  );
  lines.push('');
  lines.push('Faleminderit për bashkëpunimin,');
  lines.push(SCHOOL.name);
  lines.push(SCHOOL.phone);
  lines.push(`Datë: ${today.format('DD.MM.YYYY')}`);

  return lines.join('\n');
}

/** Kopjon tekstin ne clipboard, me rezerve per shfletues te vjeter/http. */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* provojme metoden e vjeter me poshte */
  }

  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '-1000px';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, ta.value.length);

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}