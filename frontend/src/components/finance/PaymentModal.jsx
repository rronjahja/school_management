import { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import Modal from '../ui/Modal.jsx';
import Field from '../ui/Field.jsx';
import { money } from '../../utils/format';
import { downloadSlipPdf, printSlip, paymentSlipUrl } from '../../utils/slip';
import { paymentDescription } from '../../utils/paymentNote';

export default function PaymentModal({ student, banks, onClose, onSubmit, busy, error }) {
  const suggested = student.finance.next_due?.amount || student.finance.balance;

  const [form, setForm] = useState({
    amount: suggested ? String(suggested) : '',
    payment_date: dayjs().format('YYYY-MM-DD'),
    method: 'cash',
    bank_id: '',
    note: '',
  });

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  // ---- Shënimi: i lidhur me përshkrimin e fletëpagesës ----
  // Plotësohet vetvetiu sipas shumës dhe rifreskohet sa herë ajo ndryshon.
  // Sapo përdoruesi e prek fushën, ndalon rifreskimi — teksti i tij nuk
  // duhet të fshihet nga një ndryshim i mëvonshëm i shumës.
  const noteTouched = useRef(false);

  useEffect(() => {
    if (noteTouched.current) return;
    setForm((f) => ({ ...f, note: paymentDescription(student, f.amount) }));
  }, [form.amount, student]);

  const setNote = (e) => {
    noteTouched.current = true;
    setForm((f) => ({ ...f, note: e.target.value }));
  };

  /** Kthen shënimin te teksti i propozuar dhe rinis lidhjen me shumën. */
  const resetNote = () => {
    noteTouched.current = false;
    setForm((f) => ({ ...f, note: paymentDescription(student, f.amount) }));
  };

  // Pas ruajtjes: id-ja e pagesës së re -> pamja me butonat e fletëpagesës
  const [savedId, setSavedId] = useState(null);
  const [slipBusy, setSlipBusy] = useState('');
  const [slipError, setSlipError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const id = await onSubmit({
      student_id: student.id,
      amount: Number(form.amount),
      payment_date: form.payment_date,
      method: form.method,
      bank_id: form.method === 'bank' ? Number(form.bank_id) : null,
      note: form.note.trim() || null,
    });
    if (id) setSavedId(id);
  };

  const runSlip = async (kind, fn) => {
    setSlipBusy(kind);
    setSlipError('');
    try {
      await fn();
    } catch {
      setSlipError('Gjenerimi i fletëpagesës dështoi. Provoni përsëri.');
    } finally {
      setSlipBusy('');
    }
  };

  if (savedId) {
    return (
      <Modal title="Pagesa u ruajt" onClose={onClose}>
        <div className="pay-saved">
          <p className="pay-saved-line">
            ✓ <strong>{money(form.amount)}</strong> u regjistrua për{' '}
            {student.first_name} {student.last_name}.
          </p>
          <p className="muted">
            Fletëpagesa përmban dy gjysma të njëjta — njëra pritet për klientin,
            tjetra mbetet në arkiv.
          </p>

          {slipError && <p className="form-error">{slipError}</p>}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Mbyll
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={Boolean(slipBusy)}
              onClick={() => runSlip('pdf', () =>
                downloadSlipPdf(
                  paymentSlipUrl(savedId),
                  `Fletepagesa_${student.first_name}_${student.last_name}.pdf`
                ))}
            >
              {slipBusy === 'pdf' ? 'Duke përgatitur…' : '📄 Fletëpagesa (PDF)'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={Boolean(slipBusy)}
              onClick={() => runSlip('print', () => printSlip(paymentSlipUrl(savedId)))}
            >
              {slipBusy === 'print' ? 'Duke hapur…' : '🖨 Printo fletëpagesën'}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Shto pagesë" onClose={onClose}>
      <p className="modal-hint">
        Borxhi aktual: <strong>{money(student.finance.balance)}</strong>
      </p>

      <form onSubmit={submit} className="modal-form">
        <div className="form-grid">
          <Field label="Shuma (€)" required>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={set('amount')}
              required
              autoFocus
            />
          </Field>
          <Field label="Data e pagesës" required>
            <input type="date" value={form.payment_date} onChange={set('payment_date')} required />
          </Field>
          <Field label="Mënyra e pagesës" required>
            <select value={form.method} onChange={set('method')}>
              <option value="cash">Kesh</option>
              <option value="bank">Bankë</option>
            </select>
          </Field>
          {form.method === 'bank' && (
            <Field label="Banka" required>
              <select value={form.bank_id} onChange={set('bank_id')} required>
                <option value="">Zgjidhni bankën…</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field
            label="Shënim"
            span
            hint="Shfaqet te fletëpagesa si përshkrim i pagesës. Mund ta ndryshoni ose ta fshini."
          >
            <div className="note-row">
              <input
                value={form.note}
                onChange={setNote}
                maxLength={255}
                placeholder="p.sh. Kësti i shtatorit"
              />
              {form.note !== paymentDescription(student, form.amount) && (
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={resetNote}
                  title="Kthe tekstin e propozuar"
                >
                  ↺
                </button>
              )}
            </div>
          </Field>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Anulo
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Duke ruajtur…' : 'Ruaj pagesën'}
          </button>
        </div>
      </form>
    </Modal>
  );
}