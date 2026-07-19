import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStudents } from '../api/students';
import { errorMessage } from '../api/client';
import PageHeader from '../components/ui/PageHeader.jsx';
import StatCard from '../components/ui/StatCard.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import CategoryChip from '../components/ui/CategoryChip.jsx';
import Loader from '../components/ui/Loader.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { money, date, initials } from '../utils/format';

export default function Graduates() {
  const navigate = useNavigate();
  const [students, setStudents] = useState(null);
  const [search, setSearch] = useState('');
  const [onlyDebt, setOnlyDebt] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      fetchStudents({ status: 'graduated', search: search || undefined })
        .then(setStudents)
        .catch((err) => setError(errorMessage(err)));
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const shown = useMemo(() => {
    if (!students) return null;
    return onlyDebt ? students.filter((s) => s.finance.balance > 0.005) : students;
  }, [students, onlyDebt]);

  const totals = useMemo(() => {
    if (!students) return null;
    const inDebt = students.filter((s) => s.finance.balance > 0.005);
    return {
      all: students.length,
      inDebt: inDebt.length,
      debt: inDebt.reduce((a, s) => a + s.finance.balance, 0),
      collected: students.reduce((a, s) => a + s.finance.total_paid, 0),
    };
  }, [students]);

  if (error) return <EmptyState title="Gabim" hint={error} />;
  if (!students || !shown || !totals) return <Loader />;

  return (
    <>
      <PageHeader
        title="Të diplomuarit"
        subtitle="Studentët që kanë përfunduar Vitin III — borxhi i mbetur mbetet i ndjekshëm"
      />

      <div className="stat-grid">
        <StatCard label="Të diplomuar gjithsej" value={totals.all} />
        <StatCard
          label="Me borxh të pashlyer"
          value={totals.inDebt}
          tone={totals.inDebt > 0 ? 'red' : 'green'}
        />
        <StatCard
          label="Borxh i pashlyer"
          value={money(totals.debt)}
          tone={totals.debt > 0 ? 'amber' : 'green'}
        />
        <StatCard label="Arkëtuar gjithsej" value={money(totals.collected)} tone="green" />
      </div>

      <div className="filter-bar">
        <input
          type="search"
          className="filter-search"
          placeholder="Kërko sipas emrit…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="check-inline">
          <input
            type="checkbox"
            checked={onlyDebt}
            onChange={(e) => setOnlyDebt(e.target.checked)}
          />
          Vetëm ata me borxh
        </label>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title={onlyDebt ? 'Asnjë borxh i pashlyer' : 'Ende asnjë i diplomuar'}
          hint={
            onlyDebt
              ? 'Të gjithë të diplomuarit i kanë shlyer detyrimet.'
              : 'Kalimi i vitit kryhet te faqja Cilësimet.'
          }
        />
      ) : (
        <div className="card table-card">
          <div className="table-wrap">
            <table className="table table-clickable">
              <thead>
                <tr>
                  <th>Studenti</th>
                  <th>Drejtimi</th>
                  <th>Diplomuar në</th>
                  <th>Data</th>
                  <th className="num">Detyrimi total</th>
                  <th className="num">Paguar</th>
                  <th className="num">Borxhi</th>
                  <th>Statusi</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => (
                  <tr key={s.id} onClick={() => navigate(`/studentet/${s.id}`)}>
                    <td>
                      <span className="cell-student">
                        <span className="avatar" style={{ '--avatar-color': s.category_color }}>
                          {initials(s.first_name, s.last_name)}
                        </span>
                        <span>
                          <strong>
                            {s.first_name} {s.last_name}
                          </strong>
                          <span className="muted cell-sub">{s.phone}</span>
                        </span>
                      </span>
                    </td>
                    <td>
                      <CategoryChip name={s.category_name} color={s.category_color} />
                    </td>
                    <td>{s.graduation_generation || s.generation}</td>
                    <td>{date(s.graduated_at)}</td>
                    <td className="num">{money(s.finance.total_due)}</td>
                    <td className="num cell-paid">{money(s.finance.total_paid)}</td>
                    <td className="num cell-owed">{money(s.finance.balance)}</td>
                    <td>
                      <StatusBadge status={s.finance.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}