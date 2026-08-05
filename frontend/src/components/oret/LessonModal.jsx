import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import Modal from '../ui/Modal.jsx';
import Field from '../ui/Field.jsx';

const dmy = (iso) => String(iso).split('-').reverse().join('.');

/**
 * Një qelizë e librit të orëve, e hapur.
 *
 * Çfarë sheh brenda varet nga kush je:
 *   · profesori — formular për orën e VET; orët e të tjerëve vetëm i lexon
 *   · stafi/menaxheri/admini — formular të plotë (me mbajtësin dhe
 *     zëvendësimin) dhe kontrollin: Prano / Shëno gabim
 *   · kujdestari — vetëm lexim
 *
 * Zëvendësimi kërkon TË DY emrat: kush e mbajti dhe kush mungoi. Ora i
 * numërohet mbajtësit — kjo shënohet edhe në formular, që të mos mbetet
 * dyshim se kujt i shkon ora në raportin mujor.
 */
export default function LessonModal({ cell, data, busy, onClose, onSave, onDelete, onReview }) {
    const { user } = useAuth();
    const { lesson } = cell;

    const isProfessor = data.is_professor;
    const canAdmin = data.can_admin;
    const isOwn = lesson && lesson.professor_id === user.id;

    const canEdit = lesson
        ? (canAdmin || (isProfessor && isOwn && lesson.review_status !== 'ok'))
        : (canAdmin || isProfessor);

    const [form, setForm] = useState(() => ({
        subject_id: lesson?.subject_id || data.subjects[0]?.id || '',
        topic: lesson?.topic || '',
        professor_id: lesson?.professor_id || (isProfessor ? user.id : ''),
        is_substitution: Boolean(lesson?.substitute_for),
        substitute_for: lesson?.substitute_for || '',
    }));
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [reviewOpen, setReviewOpen] = useState(false);
    const [comment, setComment] = useState('');

    const submit = () => {
        onSave({
            lesson_date: cell.date,
            period: cell.period,
            subject_id: Number(form.subject_id),
            topic: form.topic.trim(),
            professor_id: Number(form.professor_id) || undefined,
            substitute_for: form.is_substitution && form.substitute_for
                ? Number(form.substitute_for)
                : null,
        }, lesson?.id);
    };

    const title = `Ora ${cell.period} · ${dmy(cell.date)}`;

    return (
        <Modal title={title} onClose={onClose}>
            {/* Ora e pranuar nuk ndryshohet nga profesori — i thuhet, jo i fshihet */}
            {lesson && isProfessor && isOwn && lesson.review_status === 'ok' && (
                <p className="lb-note lb-note-ok">
                    Kjo orë është pranuar nga kontrolli dhe nuk ndryshohet më — drejtojuni stafit.
                </p>
            )}
            {lesson?.review_status === 'error' && (
                <p className="lb-note lb-note-bad">
                    Shënuar me gabim: «{lesson.review_comment}»
                    {lesson.reviewed_by_name && <> — {lesson.reviewed_by_name}</>}
                </p>
            )}

            {canEdit ? (
                <div className="modal-form">
                    <div className="form-grid">
                        <Field label="Lënda" required>
                            <select
                                value={form.subject_id}
                                onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
                            >
                                {data.subjects.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </Field>

                        {canAdmin ? (
                            <Field label="Kush e mbajti orën" required hint="Ora i numërohet këtij profesori">
                                <select
                                    value={form.professor_id}
                                    onChange={(e) => setForm({ ...form, professor_id: e.target.value })}
                                >
                                    <option value="">— zgjidh —</option>
                                    {data.professors.map((p) => (
                                        <option key={p.id} value={p.id}>{p.full_name}</option>
                                    ))}
                                </select>
                            </Field>
                        ) : (
                            <Field label="Kush e mbajti orën">
                                <input value={user.full_name} disabled />
                            </Field>
                        )}

                        <Field label="Njësia mësimore" required span>
                            <textarea
                                rows={3}
                                maxLength={500}
                                placeholder="p.sh. Present Simple & Continuous — stative verbs"
                                value={form.topic}
                                autoFocus={!lesson}
                                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                            />
                        </Field>

                        <Field span>
                            <label className="lb-subswitch">
                                <input
                                    type="checkbox"
                                    checked={form.is_substitution}
                                    onChange={(e) => setForm({
                                        ...form,
                                        is_substitution: e.target.checked,
                                        substitute_for: e.target.checked ? form.substitute_for : '',
                                    })}
                                />
                                <span>Kjo orë është <strong>zëvendësim</strong> — profesori i paraparë mungoi</span>
                            </label>
                        </Field>

                        {form.is_substitution && (
                            <Field
                                label="Profesori që mungoi"
                                required
                                span
                                hint="Ora i numërohet mbajtësit, jo atij që mungoi"
                            >
                                <select
                                    value={form.substitute_for}
                                    onChange={(e) => setForm({ ...form, substitute_for: e.target.value })}
                                >
                                    <option value="">— zgjidh —</option>
                                    {data.professors
                                        .filter((p) => p.id !== Number(form.professor_id))
                                        .map((p) => (
                                            <option key={p.id} value={p.id}>{p.full_name}</option>
                                        ))}
                                </select>
                            </Field>
                        )}
                    </div>

                    <div className="modal-actions lb-actions">
                        {lesson && (
                            confirmDelete ? (
                                <span className="lb-confirm">
                                    Fshihet ora?
                                    <button type="button" className="btn btn-danger btn-small"
                                        disabled={busy} onClick={() => onDelete(lesson.id)}>
                                        Po, fshije
                                    </button>
                                    <button type="button" className="btn btn-ghost btn-small"
                                        onClick={() => setConfirmDelete(false)}>
                                        Jo
                                    </button>
                                </span>
                            ) : (
                                <button type="button" className="btn btn-ghost btn-small lb-delete"
                                    onClick={() => setConfirmDelete(true)}>
                                    Fshi orën
                                </button>
                            )
                        )}
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Anulo</button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={busy || !form.subject_id || form.topic.trim().length < 3
                                || (canAdmin && !form.professor_id)
                                || (form.is_substitution && !form.substitute_for)}
                            onClick={submit}
                        >
                            {busy ? 'Duke ruajtur…' : lesson ? 'Ruaj ndryshimet' : 'Shëno orën'}
                        </button>
                    </div>
                </div>
            ) : (
                lesson && (
                    <div className="lb-view">
                        <p className="lb-view-row"><em>Lënda</em><strong>{lesson.subject_name}</strong></p>
                        <p className="lb-view-row"><em>Njësia mësimore</em><span>{lesson.topic}</span></p>
                        <p className="lb-view-row"><em>E mbajti</em><strong>{lesson.professor_name}</strong></p>
                        {lesson.substitute_for && (
                            <p className="lb-view-row">
                                <em>Zëvendësim për</em><span>{lesson.substitute_for_name}</span>
                            </p>
                        )}
                    </div>
                )
            )}

            {/* Kontrolli i stafit — vetëm mbi orë ekzistuese */}
            {lesson && data.can_review && (
                <div className="lb-review">
                    {reviewOpen ? (
                        <>
                            <textarea
                                className="dt-pop-textarea"
                                rows={2}
                                maxLength={500}
                                autoFocus
                                placeholder="p.sh. në libër ora 3 është Matematikë, jo Biologji"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                            />
                            <div className="modal-actions">
                                <button type="button" className="btn btn-ghost btn-small"
                                    onClick={() => setReviewOpen(false)}>
                                    Anulo
                                </button>
                                <button type="button" className="btn btn-danger btn-small"
                                    disabled={busy || comment.trim().length < 3}
                                    onClick={() => onReview(lesson.id, 'error', comment.trim())}>
                                    ⚑ Shëno gabim
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="modal-actions">
                            <span className="lb-review-label">Kontrolli ndaj librit fizik:</span>
                            <button type="button" className="btn btn-ghost btn-small"
                                onClick={() => { setComment(lesson.review_comment || ''); setReviewOpen(true); }}>
                                ⚑ Shëno gabim
                            </button>
                            <button type="button" className="btn btn-primary btn-small"
                                disabled={busy || lesson.review_status === 'ok'}
                                onClick={() => onReview(lesson.id, 'ok')}>
                                ✓ Prano
                            </button>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
}