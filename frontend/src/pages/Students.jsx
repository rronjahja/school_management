import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Link, useNavigate } from 'react-router-dom';
import { fetchStudents } from '../api/students';
import Pager from '../components/ui/Pager.jsx';
import { fetchCategories } from '../api/meta';
import { errorMessage } from '../api/client';
import PageHeader from '../components/ui/PageHeader.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import CategoryChip from '../components/ui/CategoryChip.jsx';
import Loader from '../components/ui/Loader.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { money, PLAN_LABELS, shortGen } from '../utils/format';
import Avatar from '../components/ui/Avatar.jsx';

/**
 * Sa nxenes merren me nje kerkese. Faqosja behet ne SERVER: perndryshe
 * cdo hapje e faqes do te lexonte te dhenat e cdo nxenesi bashke me
 * kestet e tyre, edhe pse ne ekran shihen njezet.
 */
const PER_PAGE = 20;

export default function Students() {
  const { isFinance } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState(null);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, limit: PER_PAGE });
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => { });
  }, []);

  // Nje filter i ri e nis listen nga e para: faqja 7 e nje kerkimi te
  // meparshem s'ka kuptim per rezultatet e reja.
  useEffect(() => { setPage(1); }, [search, categoryId]);

  useEffect(() => {
    setBusy(true);
    const timer = setTimeout(() => {
      fetchStudents({
        search: search || undefined,
        category_id: categoryId || undefined,
        page,
        limit: PER_PAGE,
      })
        .then((d) => {
          setStudents(d.rows);
          setMeta({ total: d.total, page: d.page, pages: d.pages, limit: d.limit });
          setError('');
        })
        .catch((err) => setError(errorMessage(err)))
        .finally(() => setBusy(false));
    }, 250); // debounce i kerkimit
    return () => clearTimeout(timer);
  }, [search, categoryId, page]);

  const isEmpty = useMemo(
    () => students && students.length === 0 && !search && !categoryId,
    [students, search, categoryId]
  );

  if (error) return <EmptyState title="Gabim" hint={error} />;

  return (
    <>
      <PageHeader
        title="Nxënësit"
        subtitle={meta.total
          ? `${meta.total.toLocaleString('de-DE')} nxënës të regjistruar`
          : 'Lista e nxënësve të regjistruar'}
      >
        <Link to="/studentet/regjistro" className="btn btn-primary">
          + Regjistro nxënës
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
          title="Ende nuk ka nxënës"
          hint="Regjistroni nxënësin e parë për të filluar."
          action={
            <Link to="/studentet/regjistro" className="btn btn-primary">
              Regjistro nxënësin e parë
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
                  <th>Nxënësi</th>
                  <th>Drejtimi</th>
                  <th>Gjenerata</th>
                  <th>Plani</th>
                  <th className="num">{isFinance ? 'Detyrimi' : 'Kuota'}</th>
                  {isFinance && <th className="num">Paguar</th>}
                  {isFinance && <th className="num">Borxhi</th>}
                  {isFinance && <th>Statusi</th>}
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} onClick={() => navigate(`/studentet/${s.id}`)}>
                    <td>
                      <span className="cell-student">
                        <Avatar student={s} />
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
                    <td className="num">{money(isFinance ? s.finance.total_due : s.yearly_quota)}</td>
                    {isFinance && <td className="num">{money(s.finance.total_paid)}</td>}
                    {isFinance && <td className="num">{money(s.finance.balance)}</td>}
                    {isFinance && (
                      <td>
                        <StatusBadge status={s.finance.status} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pager
            page={meta.page}
            pages={meta.pages}
            total={meta.total}
            limit={meta.limit}
            busy={busy}
            noun="nxënës"
            onPage={setPage}
          />
        </div>
      )}
    </>
  );
}