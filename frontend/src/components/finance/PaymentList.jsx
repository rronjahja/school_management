import { money, date } from '../../utils/format';

export default function PaymentList({ payments, onDelete }) {
  if (!payments?.length) {
    return <p className="muted">Ende nuk ka pagesa të regjistruara.</p>;
  }

  return (
    <ul className="payment-list">
      {payments.map((p) => (
        <li key={p.id} className="payment-item">
          <div className="payment-main">
            <strong>{money(p.amount)}</strong>
            <span className="payment-meta">
              {date(p.payment_date)} · {p.method === 'cash' ? 'Kesh' : p.bank_name || 'Bankë'}
              {p.note ? ` · ${p.note}` : ''}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => onDelete(p)}
            title="Fshi pagesën"
          >
            Fshi
          </button>
        </li>
      ))}
    </ul>
  );
}
