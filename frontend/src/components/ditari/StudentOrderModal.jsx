import { useMemo, useState } from 'react';
import Modal from '../ui/Modal.jsx';

/**
 * Rendi i nxënësve në ditar.
 *
 * Numri rendor është pjesë e dokumentit shkollor, ndaj rendi vendoset
 * njëherë dhe mbetet. Këtu ai ndryshohet në tri mënyra, sepse asnjëra
 * s'u shkon të gjithëve:
 *
 *   · me zvarritje (drag) — e shpejta, për një-dy lëvizje
 *   · me shigjetat ↑ ↓  — e sakta, edhe me tastierë, edhe në ekran me prekje
 *   · «Sipas alfabetit» — kthimi te rendi i zakonshëm me një klikim
 *
 * Asgjë nuk shkon në server derisa të shtypet «Ruaj rendin»: zvarritja
 * është e lehtë të bëhet pa dashje, ndaj ka gjithnjë një hap kthimi.
 */
export default function StudentOrderModal({ students, busy, onClose, onSave }) {
    const initial = useMemo(() => students.map((s) => ({ ...s })), [students]);
    const [list, setList] = useState(initial);
    const [dragIndex, setDragIndex] = useState(null);

    const fullName = (s) => `${s.first_name} ${s.last_name}`;

    const dirty = list.some((s, i) => s.id !== initial[i].id);

    /** Zhvendos një nxënës nga një pozicion në tjetrin. */
    const moveTo = (from, to) => {
        if (to < 0 || to >= list.length || from === to) return;
        setList((prev) => {
            const next = [...prev];
            const [item] = next.splice(from, 1);
            next.splice(to, 0, item);
            return next;
        });
    };

    const sortAlphabetically = () =>
        setList((prev) =>
            [...prev].sort((a, b) =>
                `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, 'sq')
            )
        );

    // Rendi ndryshon ndërsa zvarritet, jo pasi lëshohet — kështu shihet
    // menjëherë ku do të bjerë nxënësi.
    const handleDragOver = (e, index) => {
        e.preventDefault();
        if (dragIndex === null || dragIndex === index) return;
        moveTo(dragIndex, index);
        setDragIndex(index);
    };

    return (
        <Modal title="Rendi i nxënësve" onClose={onClose}>
            <p className="modal-hint">
                Zvarritni një nxënës ose përdorni shigjetat për ta zhvendosur. Numrat rendorë
                rishkruhen vetvetiu dhe ruhen kur shtypni «Ruaj rendin».
            </p>

            <div className="dt-order-tools">
                <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    onClick={sortAlphabetically}
                    disabled={busy}
                >
                    Sipas alfabetit
                </button>
                <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    onClick={() => setList(initial)}
                    disabled={busy || !dirty}
                >
                    Kthe si ishte
                </button>
                <span className="dt-order-count">{list.length} nxënës</span>
            </div>

            <ol className="dt-order-list">
                {list.map((s, i) => (
                    <li
                        key={s.id}
                        className={`dt-order-item${dragIndex === i ? ' dragging' : ''}`}
                        draggable={!busy}
                        onDragStart={() => setDragIndex(i)}
                        onDragOver={(e) => handleDragOver(e, i)}
                        onDragEnd={() => setDragIndex(null)}
                        onDrop={(e) => { e.preventDefault(); setDragIndex(null); }}
                    >
                        <span className="dt-order-grip" aria-hidden="true">⠿</span>
                        <span className="dt-order-num">{i + 1}</span>
                        <span className="dt-order-name">
                            {fullName(s)}
                            {s.parent_name && <em> · {s.parent_name}</em>}
                        </span>
                        <span className="dt-order-move">
                            <button
                                type="button"
                                className="dt-subjects-btn"
                                title="Ngjite lart"
                                disabled={busy || i === 0}
                                onClick={() => moveTo(i, i - 1)}
                            >
                                ↑
                            </button>
                            <button
                                type="button"
                                className="dt-subjects-btn"
                                title="Zbrite poshtë"
                                disabled={busy || i === list.length - 1}
                                onClick={() => moveTo(i, i + 1)}
                            >
                                ↓
                            </button>
                        </span>
                    </li>
                ))}
            </ol>

            <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={onClose}>
                    Anulo
                </button>
                <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || !dirty}
                    onClick={() => onSave(list.map((s) => s.id))}
                >
                    {busy ? 'Duke ruajtur…' : 'Ruaj rendin'}
                </button>
            </div>
        </Modal>
    );
}