import dayjs from 'dayjs';

const euro = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

export const money = (n) => euro.format(Number(n) || 0);

export const date = (d) => (d ? dayjs(d).format('DD.MM.YYYY') : '—');

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
export function parallel(className) {
  if (!className) return '—';
  return String(className).replace(/\s*[-–_]\s*/, '/');
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