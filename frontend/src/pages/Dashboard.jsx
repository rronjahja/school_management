import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Link } from 'react-router-dom';
import { fetchDashboard } from '../api/dashboard';
import { errorMessage } from '../api/client';
import HomeHero from '../components/dashboard/HomeHero.jsx';
import StatCard from '../components/ui/StatCard.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import CategoryChip from '../components/ui/CategoryChip.jsx';
import Loader from '../components/ui/Loader.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { money, date, shortGen } from '../utils/format';
import Avatar from '../components/ui/Avatar.jsx';

export default function Dashboard() {
  const { isFinance } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboard().then((d) => { setData(d); setError(''); }).catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <EmptyState title="Gabim" hint={error} />;
  if (!data) return <Loader />;

  const { totals, categories, alerts, recent } = data;
  const maxStudents = Math.max(...categories.map((c) => c.students), 1);

  return (
    <>
      <HomeHero studentCount={totals.students} />

      <div className="stat-grid">
        <StatCard label="Nxënës gjithsej" value={totals.students} />
        {isFinance && (
          <StatCard label="Të arkëtuara" value={money(totals.collected)} tone="green" secret />
        )}
        {isFinance && (
          <StatCard label="Borxh i mbetur" value={money(totals.outstanding)} tone="amber" secret />
        )}
        {isFinance && (
          <StatCard
            label="Vonesa në pagesa"
            value={totals.overdue}
            hint={`${totals.dueSoon} afër afatit`}
            tone={totals.overdue > 0 ? 'red' : 'default'}
          />
        )}
        {isFinance && totals.graduatesInDebt > 0 && (
          <StatCard
            label="Të diplomuar me borxh"
            value={totals.graduatesInDebt}
            hint={money(totals.graduatesDebt)}
            tone="red"
          />
        )}
      </div>

      <div className="dashboard-columns">
        <section className="card">
          <h2 className="card-title">Drejtimet</h2>
          {categories.length === 0 ? (
            <p className="muted">Ende nuk ka nxënës të regjistruar.</p>
          ) : (
            <ul className="category-bars">
              {categories.map((c) => (
                <li key={c.category_id}>
                  <div className="bar-head">
                    <CategoryChip name={c.name} color={c.color} />
                    <span className="bar-count">{c.students} nxënës</span>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${(c.students / maxStudents) * 100}%`,
                        background: c.color,
                      }}
                    />
                  </div>
                  <div className="bar-meta">
                    {isFinance && <span>Arkëtuar: {money(c.collected)}</span>}
                    {isFinance && <span>Borxh: {money(c.outstanding)}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {isFinance && (
        <section className="card">
          <h2 className="card-title">Paralajmërime pagesash</h2>
          {alerts.length === 0 ? (
            <p className="muted">Asnjë vonesë — të gjitha pagesat janë në rregull. ✓</p>
          ) : (
            <ul className="alert-list">
              {alerts.map((s) => (
                <li key={s.id}>
                  <Link to={`/studentet/${s.id}`} className="alert-item">
                    <Avatar student={s} />
                    <span className="alert-body">
                      <strong>
                        {s.first_name} {s.last_name}
                      </strong>
                      <span className="alert-meta">
                        {s.finance.next_due
                          ? `Kësti ${s.finance.next_due.seq} · ${date(s.finance.next_due.due_date)} · ${money(s.finance.next_due.amount)}`
                          : `Borxhi: ${money(s.finance.balance)}`}
                      </span>
                    </span>
                    <StatusBadge status={s.finance.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        )}
      </div>

      <section className="card">
        <h2 className="card-title">Regjistrimet e fundit</h2>
        {recent.length === 0 ? (
          <EmptyState
            title="Ende nuk ka nxënës"
            hint="Filloni duke regjistruar nxënësin e parë."
            action={
              <Link to="/studentet/regjistro" className="btn btn-primary">
                Regjistro nxënësin e parë
              </Link>
            }
          />
        ) : (
          <ul className="recent-list">
            {recent.map((s) => (
              <li key={s.id}>
                <Link to={`/studentet/${s.id}`} className="recent-item">
                  <Avatar student={s} />
                  <span className="recent-body">
                    <strong>
                      {s.first_name} {s.last_name}
                    </strong>
                    <span className="muted">{s.category_name} · {shortGen(s.generation)}</span>
                  </span>
                  {isFinance && <StatusBadge status={s.finance.status} />}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}