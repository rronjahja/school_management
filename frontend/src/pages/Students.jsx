import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchStudents } from '../api/students';
import { fetchCategories } from '../api/meta';
import { errorMessage } from '../api/client';
import PageHeader from '../components/ui/PageHeader.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import CategoryChip from '../components/ui/CategoryChip.jsx';
import Loader from '../components/ui/Loader.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { money, PLAN_LABELS, initials, shortGen } from '../utils/format';

export default function Students() {
  const navigate = useNavigate();
  const [students, setStudents] = useState(null);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => { });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents({
        search: search || undefined,
        category_id: categoryId || undefined,
      })
        .then((d) => { setStudents(d); setError(''); })
        .catch((err) => setError(errorMessage(err)));
    }, 250); // debounce i kerkimit
    return () => clearTimeout(timer);
  }, [search, categoryId]);

  const isEmpty = useMemo(
    () => students && students.length === 0 && !search && !categoryId,
    [students, search, categoryId]
  );

  if (error) return <EmptyState title="Gabim" hint={error} />;

  return (
    <>
      <PageHeader title="Studentët" subtitle="Lista e plotë e studentëve të regjistruar">
        <Link to="/studentet/regjistro" className="btn btn-primary">
          + Regjistro student
        </Link>
      </PageHeader>

      <div className="filter-bar">
        <input
          type="search"
          className="filter-search"
          placeholder="Kërko sipas emrit…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Të gjitha drejtimet</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {!students ? (
        <Loader />
      ) : isEmpty ? (
        <EmptyState
          title="Ende nuk ka studentë"
          hint="Regjistroni studentin e parë për të filluar."
          action={
            <Link to="/studentet/regjistro" className="btn btn-primary">
              Regjistro studentin e parë
            </Link>
          }
        />
      ) : students.length === 0 ? (
        <EmptyState title="Asnjë rezultat" hint="Provoni një kërkim tjetër ose hiqni filtrat." />
      ) : (
        <div className="card table-card">
          <div className="table-wrap">
            <table className="table table-clickable">
              <thead>
                <tr>
                  <th>Studenti</th>
                  <th>Drejtimi</th>
                  <th>Gjenerata</th>
                  <th>Plani</th>
                  <th className="num">Kuota neto</th>
                  <th className="num">Paguar</th>
                  <th className="num">Borxhi</th>
                  <th>Statusi</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
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
                          <span className="muted cell-sub">{s.city}</span>
                        </span>
                      </span>
                    </td>
                    <td>
                      <CategoryChip name={s.category_name} color={s.category_color} />
                    </td>
                    <td>{shortGen(s.generation)}</td>
                    <td>{PLAN_LABELS[s.payment_plan]}</td>
                    <td className="num">{money(s.finance.net_quota)}</td>
                    <td className="num">{money(s.finance.total_paid)}</td>
                    <td className="num">{money(s.finance.balance)}</td>
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