import StatusBadge from '../ui/StatusBadge.jsx';
import { money, date } from '../../utils/format';

export default function InstallmentTable({ installments }) {
  if (!installments?.length) return null;

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Kësti</th>
            <th>Afati</th>
            <th className="num">Shuma</th>
            <th className="num">Paguar</th>
            <th className="num">Mbetur</th>
            <th>Statusi</th>
          </tr>
        </thead>
        <tbody>
          {installments.map((inst) => (
            <tr key={inst.seq} className={`row-${inst.status}`}>
              <td>Kësti {inst.seq}</td>
              <td>{date(inst.due_date)}</td>
              <td className="num">{money(inst.amount)}</td>
              <td className="num">{money(inst.paid)}</td>
              <td className="num">{money(inst.amount - inst.paid)}</td>
              <td>
                <StatusBadge status={inst.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
