import { money, PLAN_LABELS } from '../../utils/format';

const PLAN_COUNTS = { monthly: 10, semiannual: 2, annual: 1 };

/** Llogaritje e njejte me serverin, vetem per parapamje vizuale. */
export default function FinancePreview({ quota, discountType, discountValue, plan }) {
  const gross = Number(quota) || 0;
  const value = Number(discountValue) || 0;

  let net = gross;
  if (discountType === 'percent') net = gross * (1 - value / 100);
  if (discountType === 'amount') net = gross - value;
  net = Math.max(Math.round(net * 100) / 100, 0);

  const count = PLAN_COUNTS[plan] || 1;
  const perInstallment = Math.round((net / count) * 100) / 100;

  if (!gross) return null;

  return (
    <div className="finance-preview">
      <div>
        <span className="preview-label">Kuota neto</span>
        <strong>{money(net)}</strong>
      </div>
      <div>
        <span className="preview-label">Plani</span>
        <strong>{PLAN_LABELS[plan]}</strong>
      </div>
      <div>
        <span className="preview-label">Këstet</span>
        <strong>
          {count} × {money(perInstallment)}
        </strong>
      </div>
      {net < gross && (
        <div>
          <span className="preview-label">Kurseni</span>
          <strong className="preview-save">{money(gross - net)}</strong>
        </div>
      )}
    </div>
  );
}
