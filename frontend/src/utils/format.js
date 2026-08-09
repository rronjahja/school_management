import dayjs from 'dayjs';

const euro = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

export const money = (n) => euro.format(Number(n) || 0);

export const date = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—');

/**
 * Ora e regjistrimit, p.sh. "14:32".
 *
 * KUJDES ME BURIMIN: `payment_date` eshte DATE — data kur u krye pagesa,
 * qe mund te jete edhe e djeshme. Ora vjen nga `created_at`, momenti kur
 * u shenua ne sistem. Prandaj nuk jane e njejta gje dhe nuk perzihen.
 */
export const time = (d) => (d ? dayjs(d).format('HH:mm') : '—');

/** Data dhe ora bashke, per titujt e ndihmes. */
export const dateTime = (d) => (d ? dayjs(d).format('DD/MM/YYYY HH:mm') : '—');

export const PLAN_LABELS = {
  immediate: 'E menjëhershme',
  two: '2 Këste',
  four: '4 Këste',
  six: '6 Këste',
  monthly: 'Mujore (12 muaj)',
};

/**
 * Viti shkollor AKTUAL sipas dates: gusht e tutje = viti i ri.
 * P.sh. me 19 korrik 2026 -> '2025/2026'.
 */
export function currentSchoolYear(now = new Date()) {
  const start = now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}/${start + 1}`;
}

/**
 * Gjenerata e PARAZGJEDHUR per formularin e regjistrimit.
 * Nga qershori e tutje regjistrimet behen zakonisht per vitin e ardhshem
 * shkollor, prandaj pragu ketu eshte qershori (jo gushti). Administratori
 * mund ta ndryshoje gjithmone ne formular.
 */
export function defaultRegistrationGeneration(now = new Date()) {
  const start = now.getMonth() + 1 >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}/${start + 1}`;
}

export const YEAR_LABELS = {
  1: 'Viti I',
  2: 'Viti II',
  3: 'Viti III',
};

export const STATUS_META = {
  paid: { label: 'E paguar', tone: 'green' },
  ok: { label: 'Në rregull', tone: 'neutral' },
  upcoming: { label: 'Në pritje', tone: 'neutral' },
  'due-soon': { label: 'Afër afatit', tone: 'yellow' },
  overdue: { label: 'Vonesë', tone: 'red' },
};

export const DISCOUNT_LABELS = {
  none: 'Pa zbritje',
  percent: 'Përqindje (%)',
  amount: 'Shumë fikse (€)',
};

/** Teksti i zbritjes per tabela, p.sh. "10%" ose "100,00 €". */
export function discountText(type, value) {
  if (!type || type === 'none' || !Number(value)) return '—';
  return type === 'percent' ? `${Number(value)}%` : money(value);
}

/** Paralelja ne formatin X/1 (pranon edhe "X-1" nga te dhenat e vjetra). */
/**
 * Telefoni per shfaqje: numri vendor ndahet me viza pas cdo tri shifrash
 * (044-123-456), kurse nje numer i huaj kthehet ashtu si eshte ruajtur.
 * Ne baze rrine vetem shifrat — vizat jane ceshtje pamjeje.
 */
export function phone(value) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  const digits = raw.replace(/\D/g, '');
  const local = /^0\d{8}$/.test(digits) && !/[^\d\s-]/.test(raw);
  if (!local) return raw;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}`;
}

/** Prefiksi roman sipas vitit te studimit. */
export const YEAR_ROMAN = { 1: 'X', 2: 'XI', 3: 'XII' };

/**
 * Paralelja e plote per shfaqje: viti (roman) + numri i ruajtur.
 * Ne baze ruhet vetem numri ('1'), sepse viti ndodhet te study_year —
 * keshtu te dyja nuk mund te bien ne kundershtim.
 *   classLabel(2, '1') -> 'XI/1'
 */
export function classLabel(studyYear, className) {
  if (className === null || className === undefined || String(className).trim() === '') {
    return '—';
  }
  const nr = String(className).trim();
  const roman = YEAR_ROMAN[studyYear];
  return roman ? `${roman}/${nr}` : nr;
}

/** Gjenerata e shkurter: "2026/2027" -> "2026/27". */
export function shortGen(generation) {
  const m = String(generation || '').match(/(\d{4})\s*\/\s*(\d{2,4})/);
  if (!m) return generation || '—';
  return `${m[1]}/${m[2].slice(-2)}`;
}

/** Iniciale per avatar, p.sh. "AB". */
export const initials = (first, last) =>
  `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase();