import { useState } from 'react';
import dayjs from 'dayjs';
import Modal from '../ui/Modal.jsx';
import Field from '../ui/Field.jsx';
import { money } from '../../utils/format';

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

  const submit = (e) => {
    e.preventDefault();
    onSubmit({
      student_id: student.id,
      amount: Number(form.amount),
      payment_date: form.payment_date,
      method: form.method,
      bank_id: form.method === 'bank' ? Number(form.bank_id) : null,
      note: form.note.trim() || null,
    });
  };

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
          <Field label="Shënim" span>
            <input
              value={form.note}
              onChange={set('note')}
              maxLength={255}
              placeholder="p.sh. Kësti i shtatorit"
            />
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