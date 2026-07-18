import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import Field from '../ui/Field.jsx';
import FinancePreview from './FinancePreview.jsx';
import { DISCOUNT_LABELS, PLAN_LABELS } from '../../utils/format';

const EMPTY = {
  first_name: '',
  last_name: '',
  birthday: '',
  city: '',
  address: '',
  mother_name: '',
  father_name: '',
  phone: '',
  category_id: '',
  generation: '2025/2026',
  class_name: '',
  enrollment_date: dayjs().format('YYYY-MM-DD'),
  yearly_quota: '',
  discount_type: 'none',
  discount_value: '',
  payment_plan: 'monthly',
};

export default function StudentForm({ initial, categories, onSubmit, busy, submitLabel }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, ...(initial || {}) }));

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      discount_value: form.discount_type === 'none' ? 0 : Number(form.discount_value || 0),
      yearly_quota: Number(form.yearly_quota),
    });
  };

  const discountActive = form.discount_type !== 'none';
  const categoryOptions = useMemo(() => categories || [], [categories]);

  return (
    <form className="student-form" onSubmit={handleSubmit}>
      <section className="form-section">
        <h2 className="form-section-title">Të dhënat personale</h2>
        <div className="form-grid">
          <Field label="Emri" required>
            <input value={form.first_name} onChange={set('first_name')} required maxLength={80} />
          </Field>
          <Field label="Mbiemri" required>
            <input value={form.last_name} onChange={set('last_name')} required maxLength={80} />
          </Field>
          <Field label="Datëlindja" required>
            <input type="date" value={form.birthday} onChange={set('birthday')} required />
          </Field>
          <Field label="Qyteti" required>
            <input value={form.city} onChange={set('city')} required maxLength={80} />
          </Field>
          <Field label="Adresa" required span>
            <input value={form.address} onChange={set('address')} required maxLength={160} />
          </Field>
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Prindërit dhe kontakti</h2>
        <div className="form-grid">
          <Field label="Emri i nënës" required>
            <input value={form.mother_name} onChange={set('mother_name')} required maxLength={80} />
          </Field>
          <Field label="Emri i babait" required>
            <input value={form.father_name} onChange={set('father_name')} required maxLength={80} />
          </Field>
          <Field label="Numri i telefonit" required>
            <input
              type="tel"
              value={form.phone}
              onChange={set('phone')}
              required
              maxLength={30}
              placeholder="+383 4x xxx xxx"
            />
          </Field>
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Shkollimi</h2>
        <div className="form-grid">
          <Field label="Drejtimi" required>
            <select value={form.category_id} onChange={set('category_id')} required>
              <option value="">Zgjidhni drejtimin…</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Gjenerata" required>
            <input value={form.generation} onChange={set('generation')} required placeholder="2025/2026" />
          </Field>
          <Field label="Klasa">
            <input value={form.class_name || ''} onChange={set('class_name')} placeholder="p.sh. X-1" />
          </Field>
          <Field label="Data e regjistrimit" required>
            <input type="date" value={form.enrollment_date} onChange={set('enrollment_date')} required />
          </Field>
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Financat</h2>
        <div className="form-grid">
          <Field label="Kuota vjetore (€)" required>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.yearly_quota}
              onChange={set('yearly_quota')}
              required
              placeholder="p.sh. 1500"
            />
          </Field>
          <Field label="Zbritje">
            <select value={form.discount_type} onChange={set('discount_type')}>
              {Object.entries(DISCOUNT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={form.discount_type === 'percent' ? 'Vlera e zbritjes (%)' : 'Vlera e zbritjes (€)'}>
            <input
              type="number"
              min="0"
              step="0.01"
              max={form.discount_type === 'percent' ? 100 : undefined}
              value={form.discount_value}
              onChange={set('discount_value')}
              disabled={!discountActive}
              placeholder={discountActive ? 'p.sh. 10' : '—'}
            />
          </Field>
          <Field label="Plani i pagesës" required>
            <select value={form.payment_plan} onChange={set('payment_plan')} required>
              {Object.entries(PLAN_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <FinancePreview
          quota={form.yearly_quota}
          discountType={form.discount_type}
          discountValue={form.discount_value}
          plan={form.payment_plan}
        />
      </section>

      <div className="form-footer">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Duke ruajtur…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
