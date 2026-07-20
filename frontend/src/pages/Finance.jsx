import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStudents } from '../api/students';
import { fetchCategories } from '../api/meta';
import { errorMessage } from '../api/client';
import PageHeader from '../components/ui/PageHeader.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import CategoryChip from '../components/ui/CategoryChip.jsx';
import StatCard from '../components/ui/StatCard.jsx';
import Loader from '../components/ui/Loader.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import FinanceGroups from '../components/finance/FinanceGroups.jsx';
import ReminderButton from '../components/finance/ReminderButton.jsx';
import { canRemind } from '../utils/reminder';
import { money, date, PLAN_LABELS, YEAR_LABELS, discountText } from '../utils/format';
import Avatar from '../components/ui/Avatar.jsx';

const STATUS_FILTERS = [
  ['', 'Të gjitha statuset'],
  ['overdue', 'Vonesë'],
  ['due-soon', 'Afër afatit'],
  ['ok', 'Në rregull'],
  ['paid', 'E paguar'],
];

export default function Finance() {
  const navigate = useNavigate();
  const [students, setStudents] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [plan, setPlan] = useState('');
  const [status, setStatus] = useState('');
  const [studyYear, setStudyYear] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('grouped'); // 'grouped' | 'list'
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents({
        category_id: categoryId || undefined,
        payment_plan: plan || undefined,
        study_year: studyYear || undefined,
        search: search || undefined,
      })
        .then((d) => { setStudents(d); setError(''); })
        .catch((err) => setError(errorMessage(err)));
    }, 250); // debounce i kerkimit
    return () => clearTimeout(timer);
  }, [categoryId, plan, studyYear, search]);

  const filtered = useMemo(() => {
    if (!students) return null;
    if (!status) return students;
    return students.filter((s) =>
      status === 'ok'
        ? s.finance.status === 'ok' || s.finance.status === 'upcoming'
        : s.finance.status === status
    );
  }, [students, status]);

  const totals = useMemo(() => {
    if (!filtered) return null;
    return filtered.reduce(
      (acc, s) => ({
        net: acc.net + s.finance.net_quota,
        paid: acc.paid + s.finance.total_paid,
        balance: acc.balance + s.finance.balance,
      }),
      { net: 0, paid: 0, balance: 0 }
    );
  }, [filtered]);

  if (error) return <EmptyState title="Gabim" hint={error} />;

  return (
    <>
      <PageHeader
        title="Financat"
        subtitle="Pasqyra e pagesave për çdo nxënës — kush ka paguar, kush ka mbetur"
      />

      <div className="filter-bar">
        <input
          type="search"
          className="filter-search"
          placeholder="Kërko sipas emrit…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={studyYear} onChange={(e) => setStudyYear(e.target.value)}>
          <option value="">Të gjithë vitet</option>
          {Object.entries(YEAR_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Të gjitha drejtimet</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="">Të gjitha planet</option>
          {Object.entries(PLAN_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_FILTERS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <span className="view-toggle">
          <button
            type="button"
            className={view === 'grouped' ? 'active' : ''}
            onClick={() => setView('grouped')}
          >
            Grupuar
          </button>
          <button
            type="button"
            className={view === 'list' ? 'active' : ''}
            onClick={() => setView('list')}
          >
            Listë
          </button>
        </span>
      </div>

      {!filtered || !totals ? (
        <Loader />
      ) : (
        <>
          <div className="stat-grid">
            <StatCard label="Nxënës (sipas filtrave)" value={filtered.length} />
            <StatCard label="Kuota totale neto" value={money(totals.net)} />
            <StatCard label="Të arkëtuara" value={money(totals.paid)} tone="green" />
            <StatCard
              label="Borxh i mbetur"
              value={money(totals.balance)}
              tone={totals.balance > 0 ? 'amber' : 'green'}
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="Asnjë rezultat" hint="Ndryshoni filtrat për të parë nxënësit." />
          ) : view === 'grouped' ? (
            <FinanceGroups students={filtered} />
          ) : (
            <div className="card table-card">
              <div className="table-wrap">
                <table className="table table-clickable">
                  <thead>
                    <tr>
                      <th>Nxënësi</th>
                      <th>Drejtimi</th>
                      <th>Plani</th>
                      <th className="num">Kuota</th>
                      <th>Zbritja</th>
                      <th className="num">Neto</th>
                      <th className="num">Paguar</th>
                      <th className="num">Borxhi</th>
                      <th>Kësti i ardhshëm</th>
                      <th>Statusi</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr key={s.id} onClick={() => navigate(`/studentet/${s.id}`)}>
                        <td>
                          <span className="cell-student">
                            <Avatar student={s} />
                            <strong>
                              {s.first_name} {s.last_name}
                            </strong>
                          </span>
                        </td>
                        <td>
                          <CategoryChip name={s.category_name} color={s.category_color} />
                        </td>
                        <td>{PLAN_LABELS[s.payment_plan]}</td>
                        <td className="num">{money(s.yearly_quota)}</td>
                        <td>{discountText(s.discount_type, s.discount_value)}</td>
                        <td className="num">{money(s.finance.net_quota)}</td>
                        <td className="num cell-paid">{money(s.finance.total_paid)}</td>
                        <td className="num cell-owed">{money(s.finance.balance)}</td>
                        <td>
                          {s.finance.next_due ? (
                            <span className="next-due">
                              {date(s.finance.next_due.due_date)}
                              <span className="muted"> · {money(s.finance.next_due.amount)}</span>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <StatusBadge status={s.finance.status} />
                        </td>
                        <td className="cell-tight">
                          {canRemind(s.finance) && (
                            <ReminderButton studentId={s.id} compact />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}