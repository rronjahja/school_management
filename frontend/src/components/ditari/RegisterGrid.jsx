import { useEffect, useMemo, useState } from 'react';

/**
 * Rrjeta e ditarit — riprodhon faqen e librit fizik «Suksesi i nxënësve
 * sipas lëndëve mësimore»:
 *
 *   · kolonat e lëndëve të grupuara (Gjuhët dhe komunikimi, Shkencat
 *     natyrore…) me emra vertikalë, si në libër
 *   · tre rreshta për nxënës: Gjysmëvjetori I, II dhe N.P.
 *   · brenda rreshtave I dhe II, çdo qelizë mban notat e vogla të
 *     vazhdueshme «me bojë blu» dhe, ndarë me një vijë, shifrën e madhe
 *     të kuqe të MBYLLJES së atij gjysmëvjetori — si në libër
 *   · rreshti N.P. mban mbylljen përfundimtare mbi shiritin gri
 *   · në fund: Mungesat (të paarsyeshme / të arsyeshme), Nota e
 *     sjelljes, Nota mesatare (llogaritet vetë) dhe Vërejtja
 *
 * Klikimi mbi një qelizë hap një dritare të vogël pranë saj për të
 * shtuar notën; klikimi mbi një notë ekzistuese kërkon konfirmim para
 * fshirjes — çdo veprim shkon në server dhe regjistrohet në ditarin
 * e veprimeve.
 */

const GROUP_ORDER = ['gjuhet', 'matematika', 'shkencat', 'shoqeria', 'sportet',
  'teknologjia', 'teorike', 'praktike'];

const TERM_LABELS = { gj1: 'Gjysmëvjetori I', gj2: 'Gjysmëvjetori II' };

/** Mbyllja e notës: një për çdo gjysmëvjetor, plus ajo përfundimtare. */
const CLOSING_LABELS = {
  gj1: 'Mbyllja e Gjysmëvjetorit I',
  gj2: 'Mbyllja e Gjysmëvjetorit II',
  final: 'Nota përfundimtare (N.P.)',
};

/** Sa nxënës për faqe. 0 = të gjithë, me shkarravitje si te libri i hapur. */
const PAGE_SIZES = [
  { value: 5, label: '5' },
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 0, label: 'Të gjithë' },
];

const PAGE_SIZE_KEY = 'ispe.ditari.pageSize';

/** Zgjedhja e fundit mbahet mend — kujdestari nuk e rivendos çdo herë. */
function readPageSize() {
  try {
    // Kujdes: 0 është zgjedhje e vlefshme («Të gjithë»), ndaj mungesa e
    // vlerës duhet dalluar nga vlera vetë — Number(null) jep 0.
    const raw = window.localStorage.getItem(PAGE_SIZE_KEY);
    if (raw !== null && raw !== '') {
      const saved = Number(raw);
      if (PAGE_SIZES.some((p) => p.value === saved)) return saved;
    }
  } catch {
    // Nëse shfletuesi e ka bllokuar ruajtjen lokale, thjesht vazhdohet me 10
  }
  return 10;
}

const CONDUCT_LABELS = {
  conduct_gj1: 'Nota e sjelljes — Gjysmëvjetori I',
  conduct_gj2: 'Nota e sjelljes — Gjysmëvjetori II',
  conduct_final: 'Nota e sjelljes — përfundimtare',
};

/**
 * Numrat e faqeve: te pak faqe shfaqen të gjithë, te shumë shfaqet e para,
 * e fundit dhe fqinjët e faqes aktive — pjesa tjetër zëvendësohet me «…»,
 * që shiriti të mos rritet pafund.
 */
function pageWindow(current, count) {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i);

  const pages = new Set([0, count - 1, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 0 && p < count).sort((a, b) => a - b);

  const out = [];
  let prev = null;
  for (const p of sorted) {
    if (prev !== null && p - prev > 1) out.push(null);
    out.push(p);
    prev = p;
  }
  return out;
}

/** Pozicioni i dritares pranë qelizës së klikuar, i mbajtur brenda ekranit. */
function anchorFrom(e) {
  const r = e.currentTarget.getBoundingClientRect();
  const x = Math.min(Math.max(r.left + r.width / 2, 110), window.innerWidth - 110);
  const y = Math.min(r.bottom + 6, window.innerHeight - 200);
  return { x, y };
}

export default function RegisterGrid({
  data, busy, onAddGrade, onDeleteGrade, onSetFinal, onSaveMeta,
  onReview,
}) {
  const {
    class: cls, subjects, students, grades, finals, meta,
    group_labels: groupLabels, reviews = [],
    viewer_id: viewerId,
    can_write: canWrite = true, can_review: canReview = false,
  } = data;

  // dritarja aktive: { kind, x, y, ...ngarkesa } — një e vetme në çdo kohë
  const [pop, setPop] = useState(null);
  const [draft, setDraft] = useState('');

  const [pageSize, setPageSize] = useState(readPageSize);
  const [page, setPage] = useState(0);

  /**
   * Dy mënyra pune mbi të njëjtën faqe:
   *   'write'  → plotësim notash (kujdestari i paraleles, menaxheri, admini)
   *   'review' → kontroll: pranim ose shënim gabimi, pa e prekur notën
   *
   * Kush s'ka të drejtë shkrimi nis drejt te kontrolli dhe s'del dot prej
   * tij. Kush i ka të dyja, zgjedh vetë — dhe nis te plotësimi, sepse ajo
   * është puna e përditshme.
   */
  const [mode, setMode] = useState(canWrite ? 'write' : 'review');
  const writing = mode === 'write' && canWrite;
  const reviewing = !writing && canReview;

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setPop(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Ndërrimi i paraleles ose i numrit për faqe e kthen te faqja e parë,
  // që të mos mbetet një faqe që nuk ekziston më.
  useEffect(() => { setPage(0); }, [cls.id, pageSize]);

  const changePageSize = (value) => {
    setPageSize(value);
    try { window.localStorage.setItem(PAGE_SIZE_KEY, String(value)); } catch { /* pa rëndësi */ }
  };

  const total = students.length;
  const perPage = pageSize || total || 1;
  const pageCount = pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const current = Math.min(page, pageCount - 1);
  const from = pageSize ? current * pageSize : 0;
  const visible = pageSize ? students.slice(from, from + pageSize) : students;

  const groups = useMemo(
    () =>
      GROUP_ORDER
        .map((grp) => ({ grp, label: groupLabels[grp], subjects: subjects.filter((s) => s.grp === grp) }))
        .filter((g) => g.subjects.length > 0),
    [subjects, groupLabels]
  );

  const gradesMap = useMemo(() => {
    const m = new Map();
    for (const g of grades) {
      const key = `${g.student_id}:${g.subject_id}:${g.term}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(g);
    }
    return m;
  }, [grades]);

  const finalsMap = useMemo(() => {
    const m = new Map();
    for (const f of finals) m.set(`${f.student_id}:${f.subject_id}:${f.term}`, f.value);
    return m;
  }, [finals]);

  /**
   * Kontrollet sipas objektit: një notë e vazhdueshme çelësohet me id-në
   * e vet, një mbyllje me qelizën. «Gabim» fiton mbi «e pranuar»: një
   * shenjë e kuqe nuk duhet të zhduket pas një shenje jeshile.
   */
  const reviewMap = useMemo(() => {
    const m = new Map();
    for (const r of reviews) {
      const key = r.kind === 'mark'
        ? `m:${r.grade_id}`
        : `c:${r.student_id}:${r.subject_id}:${r.term}`;
      const prev = m.get(key);
      if (!prev || (r.status === 'error' && prev.status !== 'error')) m.set(key, r);
    }
    return m;
  }, [reviews]);

  const markReview = (gradeId) => reviewMap.get(`m:${gradeId}`);
  const closingReview = (studentId, subjectId, term) =>
    reviewMap.get(`c:${studentId}:${subjectId}:${term}`);

  /** Klasa e stilit sipas kontrollit: e kuqe për gabim, jeshile për pranim. */
  const reviewClass = (rev) =>
    rev ? (rev.status === 'error' ? ' rev-error' : ' rev-ok') : '';

  const metaMap = useMemo(() => {
    const m = new Map();
    for (const row of meta) m.set(row.student_id, row);
    return m;
  }, [meta]);

  const subjectIds = useMemo(() => new Set(subjects.map((s) => s.id)), [subjects]);

  /**
   * Nota mesatare e një rreshti = mesatarja e mbylljeve të atij
   * gjysmëvjetori (ose e notave përfundimtare në rreshtin N.P.),
   * vetëm për lëndët aktive — si kolona e fundit e librit.
   */
  const averageOf = (studentId, term) => {
    const values = finals
      .filter((f) => f.student_id === studentId && f.term === term && subjectIds.has(f.subject_id))
      .map((f) => f.value);
    if (!values.length) return null;
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
  };

  const metaOf = (studentId) => metaMap.get(studentId) || {};
  const subjectName = (subjectId) => subjects.find((s) => s.id === subjectId)?.name || '';
  const studentName = (s) => `${s.first_name} ${s.last_name}`;

  // ---- hapja e dritareve ----

  const openAdd = (e, student, subject, term) => {
    // Kontrolluesi nuk shton nota: atij i hapet lista per t'i verifikuar.
    if (!writing) {
      if (!reviewing) return;
      setPop({ kind: 'reviewCell', ...anchorFrom(e), student, subject, term });
      return;
    }
    setPop({ kind: 'add', ...anchorFrom(e), student, subject, term });
  };

  const openDelete = (e, grade, student) => {
    e.stopPropagation();
    if (!writing) {
      if (!reviewing) return;
      setDraft('');
      setPop({
        kind: 'reviewOne', ...anchorFrom(e), grade, student,
        target: 'mark', current: grade.value, review: markReview(grade.id),
      });
      return;
    }
    setPop({ kind: 'delete', ...anchorFrom(e), grade, student });
  };

  const openFinal = (e, student, subject, term) => {
    e.stopPropagation();
    const current = finalsMap.get(`${student.id}:${subject.id}:${term}`) ?? null;

    // Kontrolluesi e shqyrton mbylljen pa e ndryshuar
    if (!writing) {
      if (!reviewing || current === null || current === undefined) return;
      setDraft('');
      setPop({
        kind: 'reviewOne', ...anchorFrom(e), student, subject, term,
        target: 'closing', current, review: closingReview(student.id, subject.id, term),
      });
      return;
    }

    setPop({ kind: 'final', ...anchorFrom(e), student, subject, term, current });
  };

  const openAbsence = (e, student, field, label) => {
    const current = metaOf(student.id)[field] ?? 0;
    setDraft(String(current));
    setPop({ kind: 'absence', ...anchorFrom(e), student, field, label, current });
  };

  const openConduct = (e, student, field) =>
    setPop({
      kind: 'conduct', ...anchorFrom(e), student, field,
      current: metaOf(student.id)[field] ?? null,
    });

  const openRemark = (e, student) => {
    setDraft(metaOf(student.id).remark || '');
    setPop({ kind: 'remark', ...anchorFrom(e), student });
  };

  const close = () => setPop(null);
  const commit = (fn) => { fn(); close(); };

  // ---- qelizat ----

  const renderGradeCell = (student, subject, term) => {
    const cell = gradesMap.get(`${student.id}:${subject.id}:${term}`) || [];
    const closing = finalsMap.get(`${student.id}:${subject.id}:${term}`);
    return (
      <td key={subject.id} className="dt-td">
        <div className="dt-cell">
          {/* notat e vogla të vazhdueshme */}
          <div
            className="dt-marks"
            role="button"
            tabIndex={0}
            title={`${studentName(student)} · ${subject.name} · ${TERM_LABELS[term]}`}
            onClick={(e) => openAdd(e, student, subject, term)}
            onKeyDown={(e) => e.key === 'Enter' && openAdd(e, student, subject, term)}
          >
            {cell.map((g) => {
              const rev = markReview(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  className={`dt-grade${reviewClass(rev)}`}
                  title={
                    rev?.status === 'error'
                      ? `Gabim: ${rev.comment} — ${rev.reviewed_by_name}`
                      : rev
                        ? `E kontrolluar nga ${rev.reviewed_by_name}`
                        : writing ? 'Kliko për ta fshirë këtë notë' : 'Kliko për ta kontrolluar'
                  }
                  onClick={(e) => openDelete(e, g, student)}
                >
                  {g.value}
                </button>
              );
            })}
            <span className="dt-add" aria-hidden="true">{writing ? '+' : '⌕'}</span>
          </div>

          {/* shifra e madhe e mbylljes së gjysmëvjetorit */}
          <button
            type="button"
            className={`dt-close${closing ? '' : ' dt-close-empty'}`
              + reviewClass(closingReview(student.id, subject.id, term))}
            title={`${CLOSING_LABELS[term]} · ${subject.name}`}
            onClick={(e) => openFinal(e, student, subject, term)}
          >
            {closing || '·'}
          </button>
        </div>
      </td>
    );
  };

  const renderFinalCell = (student, subject) => {
    const value = finalsMap.get(`${student.id}:${subject.id}:final`);
    return (
      <td key={subject.id} className="dt-td dt-td-np">
        <div
          className={`dt-cell dt-cell-np`
            + reviewClass(closingReview(student.id, subject.id, 'final'))}
          role="button"
          tabIndex={0}
          title={`Nota përfundimtare · ${subject.name}`}
          onClick={(e) => openFinal(e, student, subject, 'final')}
          onKeyDown={(e) => e.key === 'Enter' && openFinal(e, student, subject, 'final')}
        >
          {value ? <span className="dt-np-value">{value}</span> : <span className="dt-add">+</span>}
        </div>
      </td>
    );
  };

  const renderAbsenceCell = (student, field, label) => {
    const value = metaOf(student.id)[field] ?? 0;
    return (
      <td className="dt-td">
        <div
          className="dt-cell dt-cell-center"
          role="button"
          tabIndex={0}
          title={label}
          onClick={(e) => openAbsence(e, student, field, label)}
          onKeyDown={(e) => e.key === 'Enter' && openAbsence(e, student, field, label)}
        >
          {value > 0 ? <span className="dt-grade dt-grade-plain">{value}</span> : <span className="dt-add">+</span>}
        </div>
      </td>
    );
  };

  const renderConductCell = (student, field, isFinal) => {
    const value = metaOf(student.id)[field];
    return (
      <td className={`dt-td${isFinal ? ' dt-td-np' : ''}`}>
        <div
          className={`dt-cell dt-cell-center${isFinal ? ' dt-cell-np' : ''}`}
          role="button"
          tabIndex={0}
          title={CONDUCT_LABELS[field]}
          onClick={(e) => openConduct(e, student, field)}
          onKeyDown={(e) => e.key === 'Enter' && openConduct(e, student, field)}
        >
          {value
            ? <span className={isFinal ? 'dt-np-value' : 'dt-grade dt-grade-plain'}>{value}</span>
            : <span className="dt-add">+</span>}
        </div>
      </td>
    );
  };

  return (
    <div className="dt-book">
      <div className={`dt-paper${reviewing ? ' dt-review-mode' : ''}`}>
        <div className="dt-heading">
          <span className="dt-heading-main">Suksesi i nxënësve sipas lëndëve mësimore</span>
          <span className="dt-heading-sub">
            Paralelja {cls.name} · {cls.category_name} · {cls.school_year}
          </span>
        </div>

        {reviewing && (
          <p className="dt-review-banner">
            <span className="dt-review-badge">Kontroll</span>
            Krahasoni ditarin me librin fizik. Notat i korrigjon kujdestari i paraleles —
            ju shënoni se ku ndryshojnë, dhe gabimi i shkon atij në listë.
          </p>
        )}

        <div className="dt-toolbar">
          {writing ? (
            <p className="dt-legend">
              Kliko një qelizë për të shtuar notë · kliko një notë për ta fshirë ·
              shifra e madhe <strong className="dt-legend-np">djathtas</strong> është mbyllja e
              gjysmëvjetorit · rreshti <strong className="dt-legend-np">N.P.</strong> mban notën
              përfundimtare
            </p>
          ) : (
            <p className="dt-legend">
              Kliko një notë për ta <strong>pranuar</strong> ose për të
              <strong> shënuar gabim</strong> — notat nuk ndryshohen këtu.
              <span className="dt-legend-key"><i className="key-ok" /> e pranuar</span>
              <span className="dt-legend-key"><i className="key-bad" /> gabim</span>
            </p>
          )}

          {canWrite && canReview && (
            <div className="dt-modeswitch" role="group" aria-label="Mënyra e punës">
              <button
                type="button"
                className={`dt-mode-btn${writing ? ' active' : ''}`}
                onClick={() => setMode('write')}
              >
                Plotëso notat
              </button>
              <button
                type="button"
                className={`dt-mode-btn${reviewing ? ' active' : ''}`}
                onClick={() => setMode('review')}
              >
                Kontrollo
              </button>
            </div>
          )}

          <div className="dt-pagesize" role="group" aria-label="Sa nxënës për faqe">
            <span className="dt-pagesize-label">Shfaq</span>
            {PAGE_SIZES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`dt-pagesize-btn${pageSize === opt.value ? ' active' : ''}`}
                onClick={() => changePageSize(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="dt-scroll">
          <table className="dt-table">
            <thead>
              <tr>
                <th rowSpan={2} className="dt-th dt-sticky dt-sticky-1">Nr.</th>
                <th rowSpan={2} className="dt-th dt-sticky dt-sticky-2 dt-th-name">
                  Emri, emri i prindit<br />dhe mbiemri
                </th>
                <th rowSpan={2} className="dt-th dt-sticky dt-sticky-3" title="Gjysmëvjetori" />
                {groups.map((g) => (
                  <th key={g.grp} colSpan={g.subjects.length} className="dt-th dt-th-group">
                    {g.label}
                  </th>
                ))}
                <th colSpan={2} className="dt-th dt-th-group">Mungesat</th>
                <th rowSpan={2} className="dt-th dt-th-vert">
                  <span className="dt-vert">Nota e sjelljes</span>
                </th>
                <th rowSpan={2} className="dt-th dt-th-vert">
                  <span className="dt-vert">Nota mesatare</span>
                </th>
                <th rowSpan={2} className="dt-th dt-th-remark">Vërejtje</th>
              </tr>
              <tr>
                {groups.map((g) =>
                  g.subjects.map((s) => (
                    <th key={s.id} className="dt-th dt-th-vert" title={s.name}>
                      <span className="dt-vert">{s.name}</span>
                    </th>
                  ))
                )}
                <th className="dt-th dt-th-vert"><span className="dt-vert">Të paarsyeshme</span></th>
                <th className="dt-th dt-th-vert"><span className="dt-vert">Të arsyeshme</span></th>
              </tr>
            </thead>

            <tbody className={busy ? 'dt-busy' : ''}>
              {visible.map((student, idx) => {
                const i = from + idx;   // numri rendor mbetet ai i ditarit, jo i faqes
                const m = metaOf(student.id);
                const avgGj1 = averageOf(student.id, 'gj1');
                const avgGj2 = averageOf(student.id, 'gj2');
                const avgFinal = averageOf(student.id, 'final');
                const totalUnjust = (m.absent_unjust_gj1 ?? 0) + (m.absent_unjust_gj2 ?? 0);
                const totalJust = (m.absent_just_gj1 ?? 0) + (m.absent_just_gj2 ?? 0);

                return [
                  <tr key={`${student.id}-gj1`} className="dt-row-first">
                    <td rowSpan={3} className="dt-td dt-sticky dt-sticky-1 dt-num">{i + 1}</td>
                    <td rowSpan={3} className="dt-td dt-sticky dt-sticky-2 dt-name">
                      <span className="dt-name-line">{student.first_name}</span>
                      {student.parent_name && (
                        <span className="dt-name-line dt-name-parent">{student.parent_name}</span>
                      )}
                      <span className="dt-name-line">{student.last_name}</span>
                    </td>
                    <td className="dt-td dt-sticky dt-sticky-3 dt-term">I</td>
                    {groups.map((g) => g.subjects.map((s) => renderGradeCell(student, s, 'gj1')))}
                    {renderAbsenceCell(student, 'absent_unjust_gj1', 'Mungesa të paarsyeshme — Gjysmëvjetori I')}
                    {renderAbsenceCell(student, 'absent_just_gj1', 'Mungesa të arsyeshme — Gjysmëvjetori I')}
                    {renderConductCell(student, 'conduct_gj1', false)}
                    <td className="dt-td dt-avg">{avgGj1 || ''}</td>
                    <td rowSpan={3} className="dt-td dt-remark">
                      <div
                        className="dt-cell dt-cell-remark"
                        role="button"
                        tabIndex={0}
                        title="Vërejtje — kliko për të shkruar"
                        onClick={(e) => openRemark(e, student)}
                        onKeyDown={(e) => e.key === 'Enter' && openRemark(e, student)}
                      >
                        {m.remark
                          ? <span className="dt-remark-text">{m.remark}</span>
                          : <span className="dt-add">+</span>}
                      </div>
                    </td>
                  </tr>,

                  <tr key={`${student.id}-gj2`}>
                    <td className="dt-td dt-sticky dt-sticky-3 dt-term">II</td>
                    {groups.map((g) => g.subjects.map((s) => renderGradeCell(student, s, 'gj2')))}
                    {renderAbsenceCell(student, 'absent_unjust_gj2', 'Mungesa të paarsyeshme — Gjysmëvjetori II')}
                    {renderAbsenceCell(student, 'absent_just_gj2', 'Mungesa të arsyeshme — Gjysmëvjetori II')}
                    {renderConductCell(student, 'conduct_gj2', false)}
                    <td className="dt-td dt-avg">{avgGj2 || ''}</td>
                  </tr>,

                  <tr key={`${student.id}-np`} className="dt-row-np">
                    <td className="dt-td dt-sticky dt-sticky-3 dt-term dt-term-np">N.P.</td>
                    {groups.map((g) => g.subjects.map((s) => renderFinalCell(student, s)))}
                    <td className="dt-td dt-td-np dt-total">{totalUnjust || ''}</td>
                    <td className="dt-td dt-td-np dt-total">{totalJust || ''}</td>
                    {renderConductCell(student, 'conduct_final', true)}
                    <td className="dt-td dt-td-np dt-avg">{avgFinal || ''}</td>
                  </tr>,
                ];
              })}
            </tbody>
          </table>
        </div>

        {pageSize > 0 && total > 0 && (
          <nav className="dt-pager" aria-label="Faqet e ditarit">
            <button
              type="button"
              className="dt-pager-btn"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              ‹ Prapa
            </button>

            <span className="dt-pager-info">
              Nxënësit <strong>{from + 1}–{Math.min(from + perPage, total)}</strong> nga {total}
            </span>

            <span className="dt-pager-pages">
              {pageWindow(current, pageCount).map((p, i) =>
                p === null ? (
                  <span key={`gap-${i}`} className="dt-pager-gap">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={`dt-pager-btn dt-pager-num${p === current ? ' active' : ''}`}
                    onClick={() => setPage(p)}
                  >
                    {p + 1}
                  </button>
                )
              )}
            </span>

            <button
              type="button"
              className="dt-pager-btn"
              disabled={current >= pageCount - 1}
              onClick={() => setPage(current + 1)}
            >
              Para ›
            </button>
          </nav>
        )}
      </div>

      {pop && (
        <>
          <div className="dt-pop-backdrop" onMouseDown={close} />
          <div className="dt-pop" style={{ left: pop.x, top: pop.y }}>
            {pop.kind === 'add' && (
              <>
                <p className="dt-pop-title">
                  {studentName(pop.student)}
                  <em>{pop.subject.name} · {TERM_LABELS[pop.term]}</em>
                </p>
                <div className="dt-pop-grades">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      className="dt-pop-grade"
                      onClick={() =>
                        commit(() => onAddGrade(pop.student.id, pop.subject.id, pop.term, v))}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </>
            )}

            {pop.kind === 'delete' && (
              <>
                <p className="dt-pop-title">
                  Fshi notën <strong>{pop.grade.value}</strong>?
                  <em>{studentName(pop.student)} · {subjectName(pop.grade.subject_id)}</em>
                </p>
                <div className="dt-pop-actions">
                  <button type="button" className="btn btn-ghost btn-small" onClick={close}>
                    Anulo
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-small"
                    onClick={() => commit(() => onDeleteGrade(pop.grade.id))}
                  >
                    Fshi
                  </button>
                </div>
              </>
            )}

            {pop.kind === 'final' && (
              <>
                <p className="dt-pop-title">
                  {CLOSING_LABELS[pop.term]}
                  <em>{studentName(pop.student)} · {pop.subject.name}</em>
                </p>
                <div className="dt-pop-grades">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`dt-pop-grade dt-pop-grade-np${pop.current === v ? ' active' : ''}`}
                      onClick={() =>
                        commit(() => onSetFinal(pop.student.id, pop.subject.id, pop.term, v))}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                {pop.current !== null && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-small dt-pop-clear"
                    onClick={() =>
                      commit(() => onSetFinal(pop.student.id, pop.subject.id, pop.term, null))}
                  >
                    Hiq mbylljen
                  </button>
                )}
              </>
            )}

            {pop.kind === 'reviewCell' && (() => {
              const cell = gradesMap.get(`${pop.student.id}:${pop.subject.id}:${pop.term}`) || [];
              return (
                <>
                  <p className="dt-pop-title">
                    Kontrollo notat
                    <em>{studentName(pop.student)} · {pop.subject.name} · {TERM_LABELS[pop.term]}</em>
                  </p>
                  {cell.length === 0 ? (
                    <p className="dt-pop-note">Kjo qelizë është bosh — s'ka çfarë të kontrollohet.</p>
                  ) : (
                    <ul className="dt-rev-list">
                      {cell.map((g) => {
                        const rev = markReview(g.id);
                        return (
                          <li key={g.id} className="dt-rev-item">
                            <span className={`dt-rev-value${reviewClass(rev)}`}>{g.value}</span>
                            <span className="dt-rev-state">
                              {rev?.status === 'error'
                                ? <em className="dt-rev-bad">Gabim: {rev.comment}</em>
                                : rev
                                  ? <em className="dt-rev-good">E pranuar</em>
                                  : <em className="dt-rev-none">Pa kontrolluar</em>}
                            </span>
                            <button
                              type="button"
                              className="dt-rev-btn dt-rev-btn-ok"
                              title="Përputhet me librin"
                              onClick={() => commit(() => onReview({
                                kind: 'mark', grade_id: g.id, student_id: pop.student.id,
                                subject_id: pop.subject.id, status: 'ok',
                              }))}
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              className="dt-rev-btn dt-rev-btn-bad"
                              title="Shëno gabim"
                              onClick={(e) => {
                                setDraft(rev?.comment || '');
                                setPop({
                                  kind: 'reviewOne', ...anchorFrom(e), grade: g, student: pop.student,
                                  subject: pop.subject, term: pop.term, target: 'mark',
                                  current: g.value, review: rev, straightToError: true,
                                });
                              }}
                            >
                              ⚑
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              );
            })()}

            {pop.kind === 'reviewOne' && (
              <>
                <p className="dt-pop-title">
                  {pop.target === 'mark' ? 'Kontrollo notën' : 'Kontrollo mbylljen'} {pop.current}
                  <em>
                    {studentName(pop.student)}
                    {pop.subject && <> · {pop.subject.name}</>}
                    {pop.term && <> · {CLOSING_LABELS[pop.term] || TERM_LABELS[pop.term]}</>}
                  </em>
                </p>

                {pop.review?.status === 'error' && (
                  <p className="dt-pop-reason">Shënuar si gabim: {pop.review.comment}</p>
                )}

                <p className="dt-pop-note">
                  Nëse përputhet me librin fizik, pranojeni. Nëse jo, shkruani cila është
                  nota e saktë — korrigjimin e bën kujdestari.
                </p>

                <textarea
                  className="dt-pop-textarea"
                  rows={2}
                  maxLength={500}
                  placeholder="p.sh. në libër është 3, jo 4"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />

                <div className="dt-pop-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    onClick={() => commit(() => onReview({
                      kind: pop.target,
                      grade_id: pop.grade?.id,
                      student_id: pop.student.id,
                      subject_id: (pop.subject || {}).id
                        || (pop.grade || {}).subject_id,
                      term: pop.term,
                      status: 'ok',
                    }))}
                  >
                    ✓ Pranoj
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-small"
                    disabled={draft.trim().length < 3}
                    onClick={() => commit(() => onReview({
                      kind: pop.target,
                      grade_id: pop.grade?.id,
                      student_id: pop.student.id,
                      subject_id: (pop.subject || {}).id
                        || (pop.grade || {}).subject_id,
                      term: pop.term,
                      status: 'error',
                      comment: draft.trim(),
                    }))}
                  >
                    ⚑ Shëno gabim
                  </button>
                </div>
              </>
            )}

            {pop.kind === 'absence' && (
              <>
                <p className="dt-pop-title">
                  {pop.label}
                  <em>{studentName(pop.student)}</em>
                </p>
                <div className="dt-pop-actions">
                  <input
                    type="number"
                    min="0"
                    max="999"
                    className="dt-pop-input"
                    value={draft}
                    autoFocus
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === 'Enter'
                      && commit(() => onSaveMeta(pop.student.id, { [pop.field]: Number(draft) || 0 }))}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-small"
                    onClick={() =>
                      commit(() => onSaveMeta(pop.student.id, { [pop.field]: Number(draft) || 0 }))}
                  >
                    Ruaj
                  </button>
                </div>
              </>
            )}

            {pop.kind === 'conduct' && (
              <>
                <p className="dt-pop-title">
                  {CONDUCT_LABELS[pop.field]}
                  <em>{studentName(pop.student)}</em>
                </p>
                <div className="dt-pop-grades">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`dt-pop-grade${pop.current === v ? ' active' : ''}`}
                      onClick={() => commit(() => onSaveMeta(pop.student.id, { [pop.field]: v }))}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                {pop.current !== null && pop.current !== undefined && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-small dt-pop-clear"
                    onClick={() => commit(() => onSaveMeta(pop.student.id, { [pop.field]: null }))}
                  >
                    Hiq notën
                  </button>
                )}
              </>
            )}

            {pop.kind === 'remark' && (
              <>
                <p className="dt-pop-title">
                  Vërejtje
                  <em>{studentName(pop.student)}</em>
                </p>
                <textarea
                  className="dt-pop-textarea"
                  rows={3}
                  maxLength={500}
                  value={draft}
                  autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                />
                <div className="dt-pop-actions">
                  <button type="button" className="btn btn-ghost btn-small" onClick={close}>
                    Anulo
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-small"
                    onClick={() =>
                      commit(() => onSaveMeta(pop.student.id, { remark: draft.trim() || null }))}
                  >
                    Ruaj
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}