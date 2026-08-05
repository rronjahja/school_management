import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    fetchRegister, addGrade, deleteGrade, setFinalGrade, saveStudentMeta, saveStudentOrder,
    createEditRequest, cancelEditRequest, reviewGrade,
} from '../api/ditari';
import { errorMessage } from '../api/client';
import Loader from '../components/ui/Loader.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import RegisterGrid from '../components/ditari/RegisterGrid.jsx';
import SubjectsManager from '../components/ditari/SubjectsManager.jsx';
import StudentOrderModal from '../components/ditari/StudentOrderModal.jsx';
import { YEAR_LABELS, shortGen } from '../utils/format';

/** Rreshti bosh i mungesave/sjelljes — para se të plotësohet ndonjëherë. */
const EMPTY_META = {
    absent_just_gj1: 0, absent_unjust_gj1: 0,
    absent_just_gj2: 0, absent_unjust_gj2: 0,
    conduct_gj1: null, conduct_gj2: null, conduct_final: null,
    remark: null,
};

/**
 * Ditari i një paraleleje — faqja që mban gjendjen dhe kryen ndryshimet.
 * Pas çdo veprimi gjendja përditësohet lokalisht me përgjigjen e serverit,
 * që ditari të ndihet i menjëhershëm si libri fizik.
 */
export default function DitariKlasa() {
    const { id } = useParams();
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [actionError, setActionError] = useState('');
    const [busy, setBusy] = useState(false);
    const [subjectsOpen, setSubjectsOpen] = useState(false);
    const [orderOpen, setOrderOpen] = useState(false);

    const load = useCallback(
        () => fetchRegister(id).then(setData).catch((err) => setError(errorMessage(err))),
        [id]
    );

    useEffect(() => { load(); }, [load]);

    /** Mbështjellës i përbashkët: bllokon dyklikimet dhe kap gabimet. */
    const run = async (fn) => {
        if (busy) return;
        setBusy(true);
        setActionError('');
        try {
            await fn();
        } catch (err) {
            setActionError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const handleAddGrade = (student_id, subject_id, term, value) =>
        run(async () => {
            const grade = await addGrade(id, { student_id, subject_id, term, value });
            setData((d) => ({ ...d, grades: [...d.grades, grade] }));
        });

    const handleDeleteGrade = (gradeId) =>
        run(async () => {
            await deleteGrade(gradeId);
            setData((d) => ({ ...d, grades: d.grades.filter((g) => g.id !== gradeId) }));
        });

    /** term: 'gj1' | 'gj2' (mbyllja e gjysmëvjetorit) ose 'final' (N.P.) */
    const handleSetFinal = (student_id, subject_id, term, value) =>
        run(async () => {
            await setFinalGrade(id, { student_id, subject_id, term, value });
            setData((d) => {
                const finals = d.finals.filter(
                    (f) => !(f.student_id === student_id && f.subject_id === subject_id && f.term === term)
                );
                if (value !== null) finals.push({ student_id, subject_id, term, value });
                // Nëse ndryshimi u bë me leje, ajo sapo u shpenzua — hiqet edhe këtu,
                // që qeliza të mbyllet sërish pa pritur një rifreskim.
                const requests = (d.requests || []).filter(
                    (r) => !(r.student_id === student_id && r.subject_id === subject_id
                        && r.term === term && r.status === 'approved')
                );
                return { ...d, finals, requests };
            });
        });

    /** Bashkon ndryshimin me rreshtin ekzistues dhe e dërgon të plotë. */
    const handleSaveMeta = (student_id, patch) =>
        run(async () => {
            const current = data.meta.find((m) => m.student_id === student_id) || EMPTY_META;
            const next = { ...EMPTY_META, ...current, ...patch };
            await saveStudentMeta(id, student_id, next);
            setData((d) => ({
                ...d,
                meta: [
                    ...d.meta.filter((m) => m.student_id !== student_id),
                    { student_id, ...next },
                ],
            }));
        });

    /**
     * Kontrolli i një note: pranim ose shënim gabimi. Ditari rilexohet,
     * që shenja të dalë menjëherë mbi shifrën përkatëse.
     */
    const handleReview = (payload) =>
        run(async () => {
            await reviewGrade(id, payload);
            await load();
        });

    /**
     * Kërkesa për ndryshimin e një note të mbyllur. Pas dërgimit ditari
     * rilexohet, që qeliza të shënohet menjëherë «në pritje».
     */
    const handleRequestEdit = (student_id, subject_id, term, reason) =>
        run(async () => {
            await createEditRequest(id, { student_id, subject_id, term, reason });
            await load();
        });

    const handleCancelRequest = (requestId) =>
        run(async () => {
            await cancelEditRequest(requestId);
            await load();
        });

    /** Rendi i ri vjen si listë id-sh; serveri e rinumëron dhe ne rilexojmë. */
    const handleSaveOrder = (studentIds) =>
        run(async () => {
            await saveStudentOrder(id, studentIds);
            await load();
            setOrderOpen(false);
        });

    if (error) {
        return (
            <EmptyState
                title="Ditari nuk u hap"
                hint={error}
                action={<Link to="/ditari" className="btn btn-ghost">Kthehu te paralelet</Link>}
            />
        );
    }
    if (!data) return <Loader text="Duke hapur ditarin…" />;

    const cls = data.class;

    return (
        <>
            <div className="dt-topbar">
                <Link to="/ditari" className="btn btn-ghost btn-small">← Paralelet</Link>
                <div className="dt-topbar-info">
                    <strong>Paralelja {cls.label || cls.name}</strong>
                    <span className="muted">
                        {cls.category_name} · {YEAR_LABELS[cls.study_year]} · {shortGen(cls.school_year)}
                        {cls.kujdestar_name && <> · Kujdestari: {cls.kujdestar_name}</>}
                        {!data.can_write && data.can_review && (
                            <> · <strong className="dt-mode-review">modaliteti i kontrollit</strong></>
                        )}
                    </span>
                </div>
                {data.can_write && (
                    <>
                        <button
                            type="button"
                            className="btn btn-ghost btn-small"
                            onClick={() => setOrderOpen(true)}
                        >
                            Rendi i nxënësve
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost btn-small"
                            onClick={() => setSubjectsOpen(true)}
                        >
                            Lëndët e paraleles
                        </button>
                    </>
                )}
            </div>

            {actionError && <p className="form-error form-error-page">{actionError}</p>}

            {data.students.length === 0 ? (
                <EmptyState
                    title="Paralelja nuk ka ende nxënës"
                    hint="Nxënësit hyjnë vetvetiu në ditar sapo regjistrohen me këtë drejtim, vit studimi dhe gjeneratë."
                />
            ) : (
                <RegisterGrid
                    data={data}
                    busy={busy}
                    onAddGrade={handleAddGrade}
                    onDeleteGrade={handleDeleteGrade}
                    onSetFinal={handleSetFinal}
                    onSaveMeta={handleSaveMeta}
                    onRequestEdit={handleRequestEdit}
                    onCancelRequest={handleCancelRequest}
                    onReview={handleReview}
                />
            )}

            {orderOpen && (
                <StudentOrderModal
                    students={data.students}
                    busy={busy}
                    onClose={() => setOrderOpen(false)}
                    onSave={handleSaveOrder}
                />
            )}

            {subjectsOpen && (
                <SubjectsManager
                    classId={cls.id}
                    subjects={data.subjects}
                    groupLabels={data.group_labels}
                    onClose={() => setSubjectsOpen(false)}
                    onChanged={load}
                />
            )}
        </>
    );
}