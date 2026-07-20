import dayjs from 'dayjs';
import { SCHOOL } from '../../config/school';
import { money, date, classLabel, YEAR_LABELS } from './format';

/**
 * Emri i prindit qe duhet kontaktuar i pari.
 *
 * Zgjedhja vjen nga vete regjistrimi i nxenesit (`primary_contact`), jo nga
 * ndonje rregull i ngurte. Nese ai prind nuk ka emer te regjistruar,
 * perdoret tjetri; ne mungese te te dyve, nje formulim asnjanes.
 */
/**
 * A duhet shfaqur butoni i rikujteses?
 *
 * Vetem kur ka dicka per te kujtuar: statusi 'Vonese' (overdue) ose
 * 'Afer afatit' (due-soon). Per 'E paguar', 'Ne rregull' dhe 'Ne pritje'
 * nuk ka kuptim te dergohet nje rikujtese.
 *
 * Rregulli qendron KETU e jo neper ekrane, qe te gjitha listat te sillen
 * njesoj dhe te mos shmangen me kalimin e kohes.
 */
export function canRemind(finance) {
  const st = finance && finance.status;
  return st === 'overdue' || st === 'due-soon';
}

export function primaryContactInfo(s) {
  const full = (a, b) => [a, b].filter(Boolean).join(' ').trim();
  const mother = { name: full(s.mother_name, s.mother_last_name), gender: 'f' };
  const father = { name: full(s.father_name, s.father_last_name), gender: 'm' };
  const guardian = {
    name: full(s.guardian_name, s.guardian_last_name),
    gender: s.guardian_gender || null, // kujdestari e ka gjinine e vet
  };

  // Radha e kandidateve: i zgjedhuri i pari, pastaj rezervat.
  // GJINIA NDJEK PERSONIN QE PERFUNDON NE MESAZH, jo zgjedhjen —
  // nese eshte zgjedhur nena por vetem babai ka emer, pershendetja
  // eshte "i nderuar z.", jo "e nderuara znj.".
  const order =
    s.primary_contact === 'guardian' ? [guardian, father, mother]
      : s.primary_contact === 'mother' ? [mother, father]
        : [father, mother];

  const hit = order.find((c) => c.name);
  return hit || { name: 'prind/kujdestar', gender: null };
}

export function parentContact(s) {
  return primaryContactInfo(s).name;
}

/** "i nderuar z." / "e nderuara znj." — pa titull kur gjinia s'dihet. */
export function salutation(gender) {
  if (gender === 'm') return 'i nderuar z.';
  if (gender === 'f') return 'e nderuara znj.';
  return 'i/e nderuar';
}

/** Trajta gjinore e nxenesit ne rasat qe perdor mesazhi. */
export function studentForms(gender) {
  if (gender === 'm') return { te_nxenesit: 'të nxënësit', nxenesi: 'nxënësi' };
  if (gender === 'f') return { te_nxenesit: 'të nxënëses', nxenesi: 'nxënësja' };
  return { te_nxenesit: 'të nxënësit/es', nxenesi: 'nxënësi/ja' };
}

/**
 * Ndërton mesazhin e rikujtesës për një student.
 *
 * `student` — objekti i plotë me finance.installments (nga API-ja e studentit).
 * `banks`   — bankat NGA BAZA E TË DHËNAVE (fetchBanks); përdoren vetëm ato
 *             me numër llogarie. Asgjë në mesazh nuk vjen nga konstante të
 *             ngurta që mund të mos përputhen me studentin konkret.
 */
export function buildReminder(student, banks = [], template = null) {
  const f = student.finance || {};
  const insts = f.installments || [];

  const overdue = insts.filter((i) => i.status === 'overdue');
  const soon = insts.filter((i) => i.status === 'due-soon');
  const target = overdue.length ? overdue : soon;

  const remaining = (i) => Number(i.amount) - Number(i.paid || 0);
  const label = (i) => (i.is_carryover ? 'Borxhi i vitit të kaluar' : `Kësti ${i.seq}`);

  // ---- blloku i detyrimeve (i njejti si me pare, tani si mbajtes vendi) ----
  const dLines = [];
  if (target.length === 1) {
    const i = target[0];
    dLines.push(
      i.is_carryover
        ? `Borxhi i mbetur nga viti i kaluar shkollor është ${money(remaining(i))} ` +
            'dhe duhet shlyer sa më parë.'
        : overdue.length
          ? `Kësti ${i.seq} në shumën ${money(remaining(i))} ka pasur afat pagese më ` +
              `${date(i.due_date)} dhe ende nuk figuron i paguar.`
          : `Kësti ${i.seq} në shumën ${money(remaining(i))} ka afat pagese më ` +
              `${date(i.due_date)}.`
    );
  } else if (target.length > 1) {
    dLines.push(
      overdue.length
        ? 'Këstet e mëposhtme e kanë kaluar afatin e pagesës:'
        : 'Këstet e mëposhtme janë afër afatit të pagesës:'
    );
    target.forEach((i) => {
      dLines.push(
        i.is_carryover
          ? `  • ${label(i)} — ${money(remaining(i))}`
          : `  • ${label(i)} — afati ${date(i.due_date)} — ${money(remaining(i))}`
      );
    });
    dLines.push('');
    dLines.push(
      `Totali i ${overdue.length ? 'vonuar' : 'afërt'}: ` +
        money(target.reduce((a, i) => a + remaining(i), 0))
    );
  } else {
    dLines.push(`Detyrimi total i mbetur sipas planit është ${money(f.balance)}.`);
  }
  if (target.length && Number(f.balance) > 0) {
    dLines.push('');
    dLines.push(`Detyrimi total i mbetur sipas planit: ${money(f.balance)}.`);
  }

  // ---- llogarite bankare ----
  const withAccounts = banks.filter((b) => b.account_number);
  const bankBlock = withAccounts.length
    ? ['Pagesa mund të kryhet përmes llogarive bankare:',
       ...withAccounts.map((b) => `  ${b.name}: ${b.account_number}`)].join('\n')
    : '';

  // ---- mbajtesit e vendit ----
  const contact = primaryContactInfo(student);
  const forms = studentForms(student.gender);
  const yearLabel = YEAR_LABELS[student.study_year] || '';

  const values = {
    pershendetja: salutation(contact.gender),
    emri_kontaktit: contact.name,
    emri_nxenesit: `${student.first_name} ${student.last_name}`,
    te_nxenesit: forms.te_nxenesit,
    nxenesi: forms.nxenesi,
    drejtimi: student.category_name || '',
    viti_fraza: yearLabel ? `, ${yearLabel}` : '',
    klasa_fraza: student.class_name
      ? `, paralelja ${classLabel(student.study_year, student.class_name)}`
      : '',
    detyrimet: dLines.join('\n'),
    detyrimi_total: money(f.balance),
    llogarite_bankare: bankBlock,
    shkolla: SCHOOL.name,
    telefoni_shkolles: SCHOOL.phone,
    data: dayjs().format('DD.MM.YYYY'),
  };

  const tpl = template && template.trim() ? template : DEFAULT_TEMPLATE;

  // Mbajtesit e panjohur mbeten sic jane — gabimi shihet ne parapamje
  const rendered = tpl.replace(/\{([a-z_]+)\}/g, (whole, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : whole
  );

  // Blloqet bosh mos te lene vrima: me shume se nje rresht bosh ngjishet
  return rendered.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Parazgjedhja LOKALE perdoret vetem nese shablloni nga serveri mungon
 * (p.sh. deshtim rrjeti). Burimi i vertete eshte settingsService ne backend.
 */
const DEFAULT_TEMPLATE = [
  'Përshëndetje {pershendetja} {emri_kontaktit},',
  '',
  'Ky është një rikujtesë nga {shkolla} për obligimet financiare {te_nxenesit} ' +
    '{emri_nxenesit}, drejtimi {drejtimi}{viti_fraza}{klasa_fraza}.',
  '',
  '{detyrimet}',
  '',
  '{llogarite_bankare}',
  '',
  'Nëse pagesa është kryer tashmë, ju lutemi na dërgoni konfirmimin dhe ' +
    'konsiderojeni këtë mesazh të pavlefshëm.',
  '',
  'Faleminderit për bashkëpunimin,',
  '{shkolla}',
  '{telefoni_shkolles}',
  'Datë: {data}',
].join('\n');

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