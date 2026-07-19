import { money, date } from '../../utils/format';

/** Metoda e pageses: "Kesh" ose emri i bankes ashtu si eshte ne baze. */
function methodLabel(p) {
  if (p.method === 'cash') return 'Kesh';
  return p.bank_name || 'Bankë';
}

/**
 * Historiku i plote i pagesave te studentit + permbledhja financiare.
 *
 * SHENIM PER LLOGARINE: `finance.total_paid` eshte pjesa e pagesave qe mbulon
 * kestet AKTUALE. Pas mbylljes se nje viti, pagesat qe shlyen kestet e hequra
 * regjistrohen si "te mbyllura" dhe nuk numerohen me ketu — ndryshe do te
 * numeroheshin dy here. Prandaj tri rreshtat e fundit gjithmone perputhen:
 *      Totali − Paguar = Shuma e mbetur
 * ndersa historiku me poshte mban CDO pagese te bere ndonjehere.
 */
export default function PaymentList({ payments, finance, onDelete }) {
  const cols = onDelete ? 5 : 4;

  const totalDue = Number(finance?.total_due ?? 0);
  const paid = Number(finance?.total_paid ?? 0);
  const balance = Number(finance?.balance ?? 0);

  // Pagesa te konsumuara nga kestet e hequra gjate kalimit te vitit
  const lifetime = Number(finance?.lifetime_paid ?? paid);
  const settled = Math.round((lifetime - paid) * 100) / 100;

  return (
    <>
      {finance && (
        <div className="pay-summary">
          <div className="pay-sum-item">
            <span className="pay-sum-label">Totali për t'u paguar</span>
            <strong className="pay-sum-value">{money(totalDue)}</strong>
          </div>
          <div className="pay-sum-item">
            <span className="pay-sum-label">Paguar</span>
            <strong className="pay-sum-value pay-sum-ok">{money(paid)}</strong>
          </div>
          <div className="pay-sum-item">
            <span className="pay-sum-label">Shuma e mbetur</span>
            <strong className={`pay-sum-value${balance > 0.005 ? ' pay-sum-due' : ''}`}>
              {money(balance)}
            </strong>
          </div>
        </div>
      )}

      {settled > 0.005 && (
        <p className="muted small pay-settled-note">
          Gjithsej të paguara ndër vite: <strong>{money(lifetime)}</strong> — prej tyre{' '}
          {money(settled)} u mbyllën me vitet e kaluara dhe janë përfshirë te
          “Borxhi i vitit të kaluar”.
        </p>
      )}

      {!payments?.length ? (
        <p className="muted">Ende nuk ka pagesa të regjistruara.</p>
      ) : (
        <div className="table-wrap">
          <table className="table payment-history">
            <thead>
              <tr>
                <th>Data</th>
                <th className="num">Shuma</th>
                <th>Mënyra</th>
                <th>Shënim</th>
                {onDelete && <th />}
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{date(p.payment_date)}</td>
                  <td className="num">
                    <strong>{money(p.amount)}</strong>
                  </td>
                  <td>
                    <span className={`pay-method pay-${p.method}`}>{methodLabel(p)}</span>
                  </td>
                  <td className="pay-note">{p.note || '—'}</td>
                  {onDelete && (
                    <td className="cell-tight">
                      <button
                        type="button"
                        className="btn btn-ghost btn-small"
                        onClick={() => onDelete(p)}
                        title="Fshi pagesën"
                      >
                        Fshi
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Gjithsej të regjistruara</td>
                <td className="num">
                  <strong>{money(payments.reduce((a, p) => a + Number(p.amount), 0))}</strong>
                </td>
                <td colSpan={cols - 2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}