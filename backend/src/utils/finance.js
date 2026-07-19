const dayjs = require('dayjs');
const { PLAN_CONFIG, WARNING_DAYS, EPSILON, SIGNING_GRACE_DAYS } = require('../config/finance');

const round2 = (n) => Math.round(n * 100) / 100;

/** Kuota neto pas zbritjes (perqindje ose shume fikse). */
function computeNetQuota(yearlyQuota, discountType, discountValue) {
  const quota = Number(yearlyQuota) || 0;
  const value = Number(discountValue) || 0;

  let net = quota;
  if (discountType === 'percent') net = quota * (1 - value / 100);
  if (discountType === 'amount') net = quota - value;

  return round2(Math.max(net, 0));
}

/**
 * Gjeneron kestet sipas planit te pageses (Neni 6 i Kontratës).
 *
 * - Kesti i pare bie `SIGNING_GRACE_DAYS` dite pas dates se regjistrimit
 *   (te plani mujor dhe 6-keste: ne vete daten e regjistrimit).
 * - Datat fikse 'MM-DD' ankorohen ne vitin shkollor: gusht-dhjetor ne
 *   vitin e regjistrimit, janar-korrik ne vitin pasues.
 * - Nese nje date fikse ka kaluar para regjistrimit (regjistrim gjate vitit),
 *   ajo zhvendoset ne daten e kestit te pare.
 */
function buildInstallments(netQuota, plan, startDate) {
  const cfg = PLAN_CONFIG[plan] || PLAN_CONFIG.monthly;
  const start = dayjs(startDate);

  // Viti i fillimit te vitit shkollor
  const schoolYear = start.month() + 1 >= 8 ? start.year() : start.year() - 1;
  const fixedToDate = (mmdd) => {
    const [mm, dd] = mmdd.split('-').map(Number);
    const year = mm >= 8 ? schoolYear : schoolYear + 1;
    return dayjs(new Date(year, mm - 1, dd));
  };

  const firstDue = start.add(SIGNING_GRACE_DAYS, 'day');
  const clamp = (d) => (d.isBefore(firstDue, 'day') ? firstDue : d);

  // 1) Datat e kesteve
  let dates;
  if (plan === 'monthly') {
    dates = Array.from({ length: cfg.count }, (_, i) => start.add(i, 'month'));
  } else if (plan === 'immediate') {
    dates = [firstDue];
  } else if (plan === 'two') {
    dates = [firstDue, clamp(fixedToDate(cfg.secondDate))];
  } else if (plan === 'six') {
    dates = [start, ...cfg.fixedDates.map((d) => clamp(fixedToDate(d)))];
  } else {
    // four
    dates = [firstDue, ...cfg.fixedDates.map((d) => clamp(fixedToDate(d)))];
  }

  // 2) Shumat e kesteve
  const count = dates.length;
  let amounts;
  if (plan === 'six') {
    // Kesti i pare 30%, pjesa tjeter ndahet ne 5 pjese te barabarta
    const first = round2((netQuota * cfg.firstPercent) / 100);
    const rest = netQuota - first;
    const base = Math.floor((rest * 100) / (count - 1)) / 100;
    amounts = [first, ...Array(count - 2).fill(base), round2(rest - base * (count - 2))];
  } else {
    const base = Math.floor((netQuota * 100) / count) / 100;
    amounts = [...Array(count - 1).fill(base), round2(netQuota - base * (count - 1))];
  }

  return dates.map((d, i) => ({
    seq: i + 1,
    due_date: d.format('YYYY-MM-DD'),
    amount: amounts[i],
  }));
}

/**
 * Shperndan shumen totale te paguar neper keste sipas radhes (FIFO).
 * Kthen listen e kesteve me fushen `paid` per secilin.
 */
function allocatePayments(installments, totalPaid) {
  let remaining = Number(totalPaid) || 0;

  return installments
    .slice()
    .sort((a, b) => a.seq - b.seq)
    .map((inst) => {
      const amount = Number(inst.amount);
      const paid = round2(Math.min(remaining, amount));
      remaining = round2(remaining - paid);
      return { ...inst, amount, paid };
    });
}

/** Statusi i nje kesti: paid | overdue | due-soon | upcoming */
function installmentStatus(inst, today = dayjs()) {
  if (inst.paid >= inst.amount - EPSILON) return 'paid';

  const due = dayjs(inst.due_date);
  if (due.isBefore(today, 'day')) return 'overdue';

  const daysLeft = due.startOf('day').diff(today.startOf('day'), 'day');
  if (daysLeft <= WARNING_DAYS) return 'due-soon';

  return 'upcoming';
}

/**
 * Permbledhja financiare e nje studenti.
 * status: paid | overdue | due-soon | ok
 */
function summarizeFinance(student, installments, totalPaid, today = dayjs()) {
  const netQuota = computeNetQuota(
    student.yearly_quota,
    student.discount_type,
    student.discount_value
  );

  const allocated = allocatePayments(installments, totalPaid).map((inst) => ({
    ...inst,
    status: installmentStatus(inst, today),
  }));

  const paid = round2(Number(totalPaid) || 0);
  const balance = round2(Math.max(netQuota - paid, 0));

  let status = 'ok';
  if (balance <= EPSILON && installments.length > 0) status = 'paid';
  else if (allocated.some((i) => i.status === 'overdue')) status = 'overdue';
  else if (allocated.some((i) => i.status === 'due-soon')) status = 'due-soon';

  const nextUnpaid = allocated.find((i) => i.status !== 'paid') || null;

  return {
    net_quota: netQuota,
    total_paid: paid,
    balance,
    status,
    next_due: nextUnpaid
      ? { seq: nextUnpaid.seq, due_date: nextUnpaid.due_date, amount: round2(nextUnpaid.amount - nextUnpaid.paid) }
      : null,
    installments: allocated,
  };
}

module.exports = {
  round2,
  computeNetQuota,
  buildInstallments,
  allocatePayments,
  installmentStatus,
  summarizeFinance,
};