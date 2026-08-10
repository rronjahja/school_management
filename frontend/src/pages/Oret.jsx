import { useCallback, useEffect, useState } from 'react';
import {
    fetchLessonClasses, fetchLessonMonth, createLesson, updateLesson, deleteLesson,
    reviewLesson,
} from '../api/oret';
import { errorMessage } from '../api/client';
import PageHeader from '../components/ui/PageHeader.jsx';
import Loader from '../components/ui/Loader.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import LessonGrid from '../components/oret/LessonGrid.jsx';
import LessonModal from '../components/oret/LessonModal.jsx';

/** Muaji i sotëm si '2025-09'. */
const thisMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const MONTH_NAMES = ['Janar', 'Shkurt', 'Mars', 'Prill', 'Maj', 'Qershor',
    'Korrik', 'Gusht', 'Shtator', 'Tetor', 'Nëntor', 'Dhjetor'];

const monthLabel = (m) => {
    const [y, mo] = m.split('-');
    return `${MONTH_NAMES[Number(mo) - 1]} ${y}`;
};

/**
 * Ditari i orëve të mësimit — libri «Orët e mësimit sipas fushave dhe
 * lëndëve mësimore». Zgjidhet paralelja dhe muaji; rrjeta tregon javët
 * me deri në 7 orë në ditë. Poshtë saj, përmbledhja mujore: sa orë
 * mbajti secili profesor (zëvendësimet i numërohen zëvendësuesit).
 */
export default function Oret() {
    const [classes, setClasses] = useState(null);
    const [classId, setClassId] = useState(null);
    const [month, setMonth] = useState(thisMonth());
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [actionError, setActionError] = useState('');
    const [busy, setBusy] = useState(false);

    // qeliza e hapur: { date, period, lesson|null }
    const [openCell, setOpenCell] = useState(null);

    useEffect(() => {
        fetchLessonClasses()
            .then((rows) => {
                setClasses(rows);
                if (rows.length) setClassId((prev) => prev || rows[0].id);
            })
            .catch((err) => setError(errorMessage(err)));
    }, []);

    const load = useCallback(() => {
        if (!classId) return Promise.resolve();
        return fetchLessonMonth(classId, month)
            .then(setData)
            .catch((err) => setError(errorMessage(err)));
    }, [classId, month]);

    useEffect(() => { setData(null); load(); }, [load]);

    const run = async (fn) => {
        if (busy) return false;
        setBusy(true);
        setActionError('');
        try {
            await fn();
            await load();
            return true;
        } catch (err) {
            setActionError(errorMessage(err));
            return false;
        } finally {
            setBusy(false);
        }
    };

    const handleSave = async (payload, lessonId) => {
        const ok = await run(() =>
            lessonId ? updateLesson(lessonId, payload) : createLesson(classId, payload));
        if (ok) setOpenCell(null);
    };

    const handleDelete = async (lessonId) => {
        const ok = await run(() => deleteLesson(lessonId));
        if (ok) setOpenCell(null);
    };

    const handleReview = async (lessonId, status, comment) => {
        const ok = await run(() => reviewLesson(lessonId, { status, comment }));
        if (ok) setOpenCell(null);
    };


    if (error) return <EmptyState title="Gabim" hint={error} />;
    if (!classes) return <Loader text="Duke hapur ditarin e orëve…" />;

    if (classes.length === 0) {
        return (
            <EmptyState
                title="Ende nuk ka paralele"
                hint="Ditari i orëve hapet pasi të krijohen paralelet te faqja «Administrata»."
            />
        );
    }

    return (
        <>
            <PageHeader
                title="Orët e mësimit"
                subtitle="Orët e mësimit sipas fushave dhe lëndëve mësimore"
            />

            <div className="lb-toolbar">
                <label className="lb-pick">
                    <span>Paralelja</span>
                    <select value={classId || ''} onChange={(e) => setClassId(Number(e.target.value))}>
                        {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.label} · {c.category_name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="lb-pick">
                    <span>Muaji</span>
                    <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
                </label>
            </div>

            {actionError && <p className="form-error form-error-page">{actionError}</p>}

            {!data ? (
                <Loader text="Duke ngarkuar orët…" />
            ) : (
                <>
                    <LessonGrid
                        data={data}
                        month={month}
                        monthTitle={monthLabel(month)}
                        onOpenCell={setOpenCell}
                    />

                </>
            )}

            {openCell && data && (
                <LessonModal
                    cell={openCell}
                    data={data}
                    busy={busy}
                    onClose={() => setOpenCell(null)}
                    onSave={handleSave}
                    onDelete={handleDelete}
                    onReview={handleReview}
                />
            )}
        </>
    );
}