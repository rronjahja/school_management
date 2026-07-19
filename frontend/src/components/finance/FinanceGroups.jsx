import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../ui/StatusBadge.jsx';
import ReminderButton from './ReminderButton.jsx';
import CategoryChip from '../ui/CategoryChip.jsx';
import { money, date, PLAN_LABELS, YEAR_LABELS, initials, parallel } from '../../utils/format';

const round2 = (n) => Math.round(n * 100) / 100;

/** Mbledh totalet per nje grup studentesh. */
function aggregate(list) {
  return list.reduce(
    (a, s) => ({
      students: a.students + 1,
      net: round2(a.net + s.finance.net_quota),
      paid: round2(a.paid + s.finance.total_paid),
      balance: round2(a.balance + s.finance.balance),
      overdue: a.overdue + (s.finance.status === 'overdue' ? 1 : 0),
      dueSoon: a.dueSoon + (s.finance.status === 'due-soon' ? 1 : 0),
    }),
    { students: 0, net: 0, paid: 0, balance: 0, overdue: 0, dueSoon: 0 }
  );
}

/** Ndan studentet: viti i studimit -> drejtimi. */
function buildGroups(students) {
  const years = {};
  students.forEach((s) => {
    const y = Number(s.study_year) || 1;
    years[y] = years[y] || {};
    (years[y][s.category_id] = years[y][s.category_id] || []).push(s);
  });

  return Object.keys(years)
    .map(Number)
    .sort((a, b) => a - b)
    .map((year) => {
      const cats = Object.values(years[year])
        .map((list) => ({
          id: list[0].category_id,
          name: list[0].category_name,
          color: list[0].category_color,
          students: list,
          totals: aggregate(list),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return {
        year,
        categories: cats,
        totals: aggregate(cats.flatMap((c) => c.students)),
      };
    });
}

export default function FinanceGroups({ students }) {
  const navigate = useNavigate();
  const groups = useMemo(() => buildGroups(students), [students]);

  // Vitet e hapura si parazgjedhje; drejtimet te mbyllura (permbledhje e paster)
  const [closedYears, setClosedYears] = useState({});
  const [openCats, setOpenCats] = useState({});

  const toggleYear = (y) => setClosedYears((s) => ({ ...s, [y]: !s[y] }));
  const toggleCat = (key) => setOpenCats((s) => ({ ...s, [key]: !s[key] }));

  if (!groups.length) return null;

  return (
    <div className="fin-groups">
      {groups.map((g) => {
        const yearOpen = !closedYears[g.year];
        return (
          <section className="fin-year" key={g.year}>
            <button
              type="button"
              className="fin-head fin-head-year"
              onClick={() => toggleYear(g.year)}
              aria-expanded={yearOpen}
            >
              <span className={`fin-caret${yearOpen ? ' open' : ''}`} aria-hidden="true">
                ▸
              </span>
              <span className="fin-title">{YEAR_LABELS[g.year] || `Viti ${g.year}`}</span>
              <Totals t={g.totals} />
            </button>

            {yearOpen && (
              <div className="fin-year-body">
                {g.categories.map((c) => {
                  const key = `${g.year}-${c.id}`;
                  const catOpen = Boolean(openCats[key]);
                  return (
                    <div className="fin-cat" key={key}>
                      <button
                        type="button"
                        className="fin-head fin-head-cat"
                        onClick={() => toggleCat(key)}
                        aria-expanded={catOpen}
                      >
                        <span className={`fin-caret${catOpen ? ' open' : ''}`} aria-hidden="true">
                          ▸
                        </span>
                        <CategoryChip name={c.name} color={c.color} />
                        <Totals t={c.totals} />
                      </button>

                      {catOpen && (
                        <div className="table-wrap fin-cat-table">
                          <table className="table table-clickable">
                            <thead>
                              <tr>
                                <th>Studenti</th>
                                <th>Paralelja</th>
                                <th>Plani</th>
                                <th className="num">Neto</th>
                                <th className="num">Paguar</th>
                                <th className="num">Borxhi</th>
                                <th>Kësti i ardhshëm</th>
                                <th>Statusi</th>
                                <th />
                              </tr>
                            </thead>
                            <tbody>
                              {c.students.map((s) => (
                                <tr key={s.id} onClick={() => navigate(`/studentet/${s.id}`)}>
                                  <td>
                                    <span className="cell-student">
                                      <span
                                        className="avatar"
                                        style={{ '--avatar-color': s.category_color }}
                                      >
                                        {initials(s.first_name, s.last_name)}
                                      </span>
                                      <strong>
                                        {s.first_name} {s.last_name}
                                      </strong>
                                    </span>
                                  </td>
                                  <td>{parallel(s.class_name)}</td>
                                  <td>{PLAN_LABELS[s.payment_plan]}</td>
                                  <td className="num">{money(s.finance.net_quota)}</td>
                                  <td className="num cell-paid">{money(s.finance.total_paid)}</td>
                                  <td className="num cell-owed">{money(s.finance.balance)}</td>
                                  <td>
                                    {s.finance.next_due
                                      ? date(s.finance.next_due.due_date)
                                      : '—'}
                                  </td>
                                  <td>
                                    <StatusBadge status={s.finance.status} />
                                  </td>
                                  <td className="cell-tight">
                                    {(s.finance.status === 'overdue' ||
                                      s.finance.status === 'due-soon') && (
                                      <ReminderButton studentId={s.id} compact />
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Totals({ t }) {
  return (
    <span className="fin-totals">
      <span className="fin-stat">
        <em>{t.students}</em> studentë
      </span>
      <span className="fin-stat">
        Arkëtuar <em className="cell-paid">{money(t.paid)}</em>
      </span>
      <span className="fin-stat">
        Borxh <em className="cell-owed">{money(t.balance)}</em>
      </span>
      {t.overdue > 0 && <span className="badge badge-red">{t.overdue} vonesa</span>}
      {t.dueSoon > 0 && <span className="badge badge-yellow">{t.dueSoon} afër afatit</span>}
    </span>
  );
}