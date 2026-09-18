import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStudents, fetchStudent } from '../api/students';
import { fetchCategories, fetchBanks } from '../api/meta';
import { createPayment } from '../api/payments';
import { useAuth } from '../context/AuthContext.jsx';
import { useStickyState, useScrollRestore } from '../hooks/usePageState';
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
import { downloadFinanceExcel } from '../api/meta';
import { money, date, PLAN_LABELS, YEAR_LABELS, discountText } from '../utils/format';
import Avatar from '../components/ui/Avatar.jsx';
import PaymentModal from '../components/finance/PaymentModal.jsx';

const round2 = (n) => Math.round(n * 100) / 100;

const STATUS_FILTERS = [
  ['', 'Të gjitha statuset'],
  ['overdue', 'Vonesë'],
  ['due-soon', 'Afër afatit'],
  ['ok', 'Në rregull'],
  ['paid', 'E paguar'],
];

export default function Finance() {
  const navigate = useNavigate();
  const { isFinance } = useAuth();
  const [students, setStudents] = useState(null);
  useScrollRestore('financat', Boolean(students));
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useStickyState('fin:categoryId', '');
  const [plan, setPlan] = useStickyState('fin:plan', '');
  const [status, setStatus] = useStickyState('fin:status', '');
  const [studyYear, setStudyYear] = useStickyState('fin:studyYear', '');
  const [search, setSearch] = useStickyState('fin:search', '');
  const [view, setView] = useStickyState('fin:view', 'grouped'); // 'grouped' | 'list'
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => { });
  }, []);

  const [banks, setBanks] = useState([]);
  const [payFor, setPayFor] = useState(null);
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState('');

  useEffect(() => {
    if (isFinance) fetchBanks().then(setBanks).catch(() => { });
  }, [isFinance]);

  const reload = () => fetchStudents({
    category_id: categoryId || undefined,
    payment_plan: plan || undefined,
    study_year: studyYear || undefined,
    search: search || undefined,
  })
    .then((d) => { setStudents(d); setError(''); })
    .catch((err) => setError(errorMessage(err)));

  const openPayment = async (student) => {
    setPayError('');
    try {
      setPayFor(await fetchStudent(student.id));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const handlePayment = async (data) => {
    setPayBusy(true);
    setPayError('');
    try {
      const updated = await createPayment(data);
      setPayFor(updated);
      await reload();
      return updated.last_payment_id || null;
    } catch (err) {
      setPayError(errorMessage(err));
      return null;
    } finally {
      setPayBusy(false);
    }
  };

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

  // ---- Eksporti në Excel: gjeneratat e nxënësve aktivë, më e reja e para ----
  const generations = useMemo(() => {
    // Rendit sipas numrit të nxënësve: viti në vazhdim (me shumicën e
    // nxënësve) del i pari dhe bëhet parazgjedhja — jo viti i ardhshëm
    // ku sapo kanë nisur regjistrimet e para.
    const counts = new Map();
    (students || []).forEach((s) => {
      if (s.generation) counts.set(s.generation, (counts.get(s.generation) || 0) + 1);
    });
    return [...counts.keys()].sort(
      (a, b) => counts.get(b) - counts.get(a) || b.localeCompare(a)
    );
  }, [students]);
  const [exportGen, setExportGen] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const chosenGen = exportGen || generations[0] || '';

  const exportExcel = async () => {
    if (!chosenGen) return;
    setExporting(true);
    setExportError('');
    try {
      await downloadFinanceExcel(chosenGen);
    } catch {
      setExportError('Eksporti dështoi. Provoni përsëri.');
    } finally {
      setExporting(false);
    }
  };

  const filtered = useMemo(() => {
    if (!students) return null;
    if (!status) return students;
    return students.filter((s) =>
      status === 'ok'
        ? s.finance.status === 'ok' || s.finance.status === 'upcoming'
        : s.finance.status === status
    );
  }, [students, status]);

  // `total_due` e jo `net_quota`: kuota neto eshte vetem e vitit AKTUAL,
  // ndersa borxhi llogaritet mbi TE GJITHA kestet (perfshire borxhin e
  // bartur). Po t'i perzienim, rreshti nuk do te mbyllej: kuota - paguar
  // nuk do te binte kurre me borxhin.
  const totals = useMemo(() => {
    if (!filtered) return null;
    return filtered.reduce(
      (acc, s) => ({
        net: round2(acc.net + s.finance.total_due),
        paid: round2(acc.paid + s.finance.total_paid),
        balance: round2(acc.balance + s.finance.balance),
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
      >
        <div className="excel-export">
          {generations.length > 1 && (
            <select
              value={chosenGen}
              onChange={(e) => setExportGen(e.target.value)}
              title="Gjenerata që eksportohet"
            >
              {generations.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="btn btn-excel"
            onClick={exportExcel}
            disabled={exporting || !chosenGen}
            title={chosenGen ? `Shkarko pagesat e gjeneratës ${chosenGen} në Excel` : ''}
          >
            <ExcelIcon />
            {exporting ? 'Duke përgatitur…' : 'Excel'}
          </button>
        </div>
      </PageHeader>
      {exportError && <p className="form-error">{exportError}</p>}

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
            <StatCard label="Detyrimi total" value={money(totals.net)} secret />
            <StatCard label="Të arkëtuara" value={money(totals.paid)} tone="green" secret />
            <StatCard
              label="Borxh i mbetur"
              value={money(totals.balance)}
              tone={totals.balance > 0 ? 'amber' : 'green'}
              secret
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="Asnjë rezultat" hint="Ndryshoni filtrat për të parë nxënësit." />
          ) : view === 'grouped' ? (
            <FinanceGroups students={filtered} onPay={isFinance ? openPayment : undefined} />
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
                        <td className="num">{money(s.finance.total_due)}</td>
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
                          <span className="status-cell">
                            <StatusBadge status={s.finance.status} />
                            {canRemind(s.finance) && (
                              <ReminderButton studentId={s.id} compact />
                            )}
                          </span>
                        </td>
                        <td className="cell-tight">
                          {isFinance && Number(s.finance.balance) > 0.004 && (
                            <button
                              type="button"
                              className="btn btn-primary btn-small"
                              onClick={(e) => { e.stopPropagation(); openPayment(s); }}
                            >
                              Bëj pagesë
                            </button>
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

      {payFor && (
        <PaymentModal
          student={payFor}
          banks={banks}
          busy={payBusy}
          error={payError}
          onClose={() => { setPayFor(null); setPayError(''); }}
          onSubmit={handlePayment}
        />
      )}
    </>
  );
}

/** Fletë llogaritëse jeshile me rrjetë — ikona e eksportit. */
function ExcelIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="2.5" width="14" height="19" rx="2" fill="#1D6F42" />
      <path d="M14 2.5h3a2 2 0 0 1 2 2v3h-5v-5Z" fill="#2E8B57" />
      <path
        d="M6.6 8.6h2l1.4 2.5 1.4-2.5h2l-2.4 3.9 2.5 4h-2l-1.5-2.6-1.5 2.6h-2l2.5-4-2.4-3.9Z"
        fill="#fff"
      />
    </svg>
  );
}