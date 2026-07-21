/**
 * Përshkrimi i një pagese — i njëjti tekst që del te fletëpagesa.
 *
 * Serveri e ndërton përshkrimin duke rishpërndarë TË GJITHA pagesat mbi
 * këstet (FIFO). Këtu nisemi nga gjendja e tanishme e çdo kësti (sa është
 * paguar tashmë) dhe derdhim mbi të vetëm shumën e re — rezultati del i
 * njëjtë, por pa pritur përgjigjen e serverit.
 *
 * Përputhet me describeSlots()/installmentsCoveredBy() te
 * backend/src/services/documentService.js — nëse ndryshon njëri, ndryshoni
 * edhe tjetrin.
 */

const EPS = 0.004;

/** Cilat këste do t'i prekte një pagesë e re prej `amount`? */
export function slotsCoveredBy(installments, amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return [];

  const slots = (installments || [])
    .map((i) => ({
      seq: i.is_carryover ? 0 : i.seq,
      carry: Boolean(i.is_carryover),
      remaining: Number(i.amount) - Number(i.paid || 0),
    }))
    .filter((s) => s.remaining > EPS)
    .sort((a, b) => a.seq - b.seq);

  const covered = [];
  let left = value;
  for (const s of slots) {
    if (left <= EPS) break;
    covered.push(s);
    left = Math.round((left - Math.min(s.remaining, left)) * 100) / 100;
  }
  return covered;
}

/** ['Kësti 1','Kësti 2','Kësti 3'] -> "Kësti 1, 2 dhe 3" */
export function describeSlots(slots) {
  const parts = [];
  if (slots.some((s) => s.carry)) parts.push('Borxhi i vitit të kaluar');

  const seqs = slots.filter((s) => !s.carry).map((s) => s.seq);
  if (seqs.length === 1) parts.push(`Kësti ${seqs[0]}`);
  else if (seqs.length === 2) parts.push(`Kësti ${seqs[0]} dhe ${seqs[1]}`);
  else if (seqs.length > 2) {
    parts.push(`Kësti ${seqs.slice(0, -1).join(', ')} dhe ${seqs[seqs.length - 1]}`);
  }
  return parts.join(' dhe ');
}

/**
 * Teksti i plotë, si te fletëpagesa:
 *   "Kësti 2 — Teknik i Farmacisë, viti shkollor 2025/2026"
 */
export function paymentDescription(student, amount) {
  const what = describeSlots(
    slotsCoveredBy(student?.finance?.installments, amount)
  ) || 'Pagesë shkollimi';

  const tail = [student?.category_name, student?.generation ? `viti shkollor ${student.generation}` : null]
    .filter(Boolean)
    .join(', ');

  return tail ? `${what} — ${tail}` : what;
}