import { useMemo } from 'react';

/**
 * Rrjeta e librit të orëve: javët e muajit si blloqe, ditët e punës si
 * rreshta (e hënë – e premte), orët 1–7 si kolona — si faqja fizike blu.
 *
 * Çdo qelizë me orë tregon lëndën, temën «me bojë», mbajtësin dhe:
 *   Z — zëvendësim (ora i numërohet zëvendësuesit)
 *   ✓ — e pranuar nga kontrolli    ⚑ — e shënuar me gabim
 *
 * Klikimi mbi çdo qelizë i takon faqes (onOpenCell): ajo di kush je dhe
 * hap formularin, pamjen apo kontrollin sipas të drejtave.
 */

const DAY_LABELS = ['E hënë', 'E martë', 'E mërkurë', 'E enjte', 'E premte'];

const PERIODS = [1, 2, 3, 4, 5, 6, 7];

/** Ditët e punës të muajit '2025-09', të grupuara sipas javëve. */
function weekdaysOf(month) {
    const [y, m] = month.split('-').map(Number);
    const weeks = [];
    let current = [];
    for (let day = 1; day <= 31; day += 1) {
        const d = new Date(Date.UTC(y, m - 1, day));
        if (d.getUTCMonth() !== m - 1) break;
        const dow = d.getUTCDay();
        if (dow === 1 && current.length) { weeks.push(current); current = []; }
        if (dow >= 1 && dow <= 5) {
            current.push({
                iso: `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
                label: DAY_LABELS[dow - 1],
                dm: `${String(day).padStart(2, '0')}/${String(m).padStart(2, '0')}`,
            });
        }
    }
    if (current.length) weeks.push(current);
    return weeks;
}

/** «Arta Krasniqi» → «A. Krasniqi» — sa për fund të qelizës. */
function shortName(full) {
    const parts = String(full || '').trim().split(/\s+/);
    if (parts.length < 2) return full || '';
    return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

export default function LessonGrid({ data, month, monthTitle, onOpenCell }) {
    const weeks = useMemo(() => weekdaysOf(month), [month]);

    const lessonMap = useMemo(() => {
        const m = new Map();
        for (const l of data.lessons) m.set(`${l.lesson_date}:${l.period}`, l);
        return m;
    }, [data.lessons]);

    const canFill = data.can_admin || data.is_professor;

    return (
        <div className="lb-book">
            <div className="lb-paper">
                <div className="lb-heading">
                    <span className="lb-heading-main">Orët e mësimit sipas fushave dhe lëndëve mësimore</span>
                    <span className="lb-heading-sub">
                        Paralelja {data.class.label} · {data.class.category_name} · {monthTitle}
                    </span>
                </div>

                <p className="lb-legend">
                    {canFill
                        ? 'Kliko një qelizë bosh për të shënuar orën · kliko një orë për ta hapur'
                        : 'Kliko një orë për ta parë'}
                    <span className="lb-key"><b className="lb-key-z">Z</b> zëvendësim</span>
                    <span className="lb-key"><b className="lb-key-ok">✓</b> e pranuar</span>
                    <span className="lb-key"><b className="lb-key-bad">⚑</b> gabim</span>
                </p>

                <div className="lb-scroll">
                    {weeks.map((week, wi) => (
                        <table key={wi} className="lb-table">
                            <thead>
                                <tr>
                                    <th className="lb-th lb-th-day">Dita dhe data</th>
                                    {PERIODS.map((p) => (
                                        <th key={p} className="lb-th">{p}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {week.map((day) => (
                                    <tr key={day.iso}>
                                        <td className="lb-day">
                                            <span className="lb-day-name">{day.label}</span>
                                            <span className="lb-day-date">{day.dm}</span>
                                        </td>
                                        {PERIODS.map((p) => {
                                            const lesson = lessonMap.get(`${day.iso}:${p}`);
                                            return (
                                                <td key={p} className="lb-td">
                                                    <div
                                                        className={`lb-cell${lesson ? ' filled' : ''}`
                                                            + `${lesson?.review_status === 'ok' ? ' rev-ok' : ''}`
                                                            + `${lesson?.review_status === 'error' ? ' rev-error' : ''}`}
                                                        role="button"
                                                        tabIndex={0}
                                                        title={lesson
                                                            ? `${lesson.subject_name} — ${lesson.professor_name}`
                                                            : canFill ? `Shëno orën ${p} · ${day.label} ${day.dm}` : undefined}
                                                        onClick={() => (lesson || canFill)
                                                            && onOpenCell({ date: day.iso, period: p, lesson: lesson || null })}
                                                        onKeyDown={(e) => e.key === 'Enter' && (lesson || canFill)
                                                            && onOpenCell({ date: day.iso, period: p, lesson: lesson || null })}
                                                    >
                                                        {lesson ? (
                                                            <>
                                                                <span className="lb-subject">{lesson.subject_name}</span>
                                                                <span className="lb-topic">{lesson.topic}</span>
                                                                <span className="lb-foot">
                                                                    <span className="lb-prof">{shortName(lesson.professor_name)}</span>
                                                                    {lesson.substitute_for && (
                                                                        <b className="lb-key-z" title={`Zëvendësim për ${lesson.substitute_for_name}`}>
                                                                            Z
                                                                        </b>
                                                                    )}
                                                                    {lesson.review_status === 'ok' && (
                                                                        <b className="lb-key-ok" title={`E pranuar nga ${lesson.reviewed_by_name}`}>✓</b>
                                                                    )}
                                                                    {lesson.review_status === 'error' && (
                                                                        <b className="lb-key-bad" title={lesson.review_comment}>⚑</b>
                                                                    )}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            canFill && <span className="lb-add" aria-hidden="true">+</span>
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ))}
                </div>
            </div>
        </div>
    );
}