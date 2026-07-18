import dayjs from 'dayjs';

const euro = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

export const money = (n) => euro.format(Number(n) || 0);

export const date = (d) => (d ? dayjs(d).format('DD.MM.YYYY') : '—');

export const PLAN_LABELS = {
  monthly: 'Mujore',
  semiannual: '6-Mujore',
  annual: 'Vjetore',
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

/** Iniciale per avatar, p.sh. "AB". */
export const initials = (first, last) =>
  `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase();
