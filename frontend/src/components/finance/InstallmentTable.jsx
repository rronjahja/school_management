import StatusBadge from '../ui/StatusBadge.jsx';
import { money, date, shortGen } from '../../utils/format';

/**
 * @param selected  Set me numrat e kësteve të zgjedhura (0 = bartja)
 * @param onToggle  thirret me numrin e këstit; nëse mungon, tabela s'ka zgjedhje
 */
export default function InstallmentTable({ installments, selected, onToggle }) {
  if (!installments?.length) return null;

  const selectable = typeof onToggle === 'function';
  const keyOf = (i) => (i.is_carryover ? 0 : Number(i.seq));

  // Borxhi i bartur eshte i kuq vetem derisa te shlyhet; pasi paguhet
  // trajtohet si cdo kest tjeter i mbyllur.
  const isSettled = (i) => Number(i.amount) - Number(i.paid || 0) <= 0.005;

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {selectable && <th className="pick-col" aria-label="Zgjidh" />}
            <th>Kësti</th>
            <th>Afati</th>
            <th className="num">Shuma</th>
            <th className="num">Paguar</th>
            <th className="num">Mbetur</th>
            <th>Statusi</th>
          </tr>
        </thead>
        <tbody>
          {installments.map((inst) =>
            inst.is_carryover ? (
              <tr
                key={inst.seq}
                className={isSettled(inst) ? `row-${inst.status}` : 'row-carryover'}
              >
                {selectable && (
                  <td className="pick-col">
                    {!isSettled(inst) && (
                      <input
                        type="checkbox"
                        checked={selected.has(0)}
                        onChange={() => onToggle(0)}
                        aria-label="Zgjidh borxhin e vitit të kaluar"
                      />
                    )}
                  </td>
                )}
                <td colSpan={2}>
                  <strong>Borxhi i vitit të kaluar</strong>
                  {inst.generation && (
                    <span className="carryover-gen"> ({shortGen(inst.generation)})</span>
                  )}
                </td>
                <td className="num">{money(inst.amount)}</td>
                <td className="num">{money(inst.paid)}</td>
                <td className="num">
                  <strong>{money(inst.amount - inst.paid)}</strong>
                </td>
                <td>
                  <StatusBadge status={inst.status} />
                </td>
              </tr>
            ) : (
              <tr key={inst.seq} className={`row-${inst.status}`}>
                {selectable && (
                  <td className="pick-col">
                    {!isSettled(inst) && (
                      <input
                        type="checkbox"
                        checked={selected.has(keyOf(inst))}
                        onChange={() => onToggle(keyOf(inst))}
                        aria-label={`Zgjidh kestin ${inst.seq}`}
                      />
                    )}
                  </td>
                )}
                <td>Kësti {inst.seq}</td>
                <td>{date(inst.due_date)}</td>
                <td className="num">{money(inst.amount)}</td>
                <td className="num">{money(inst.paid)}</td>
                <td className="num">{money(inst.amount - inst.paid)}</td>
                <td>
                  <StatusBadge status={inst.status} />
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}