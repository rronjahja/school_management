import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import Field from '../ui/Field.jsx';
import { fetchNextContractNumber } from '../../api/students';
import FinancePreview from './FinancePreview.jsx';
import { DISCOUNT_LABELS, PLAN_LABELS, YEAR_LABELS } from '../../utils/format';
import { ACADEMIC_YEAR } from '../../../config/school';

const EMPTY = {
  first_name: '',
  last_name: '',
  birthday: '',
  city: '',
  address: '',
  phone: '',
  email: '',
  citizenship: 'Kosovar',
  nationality: 'Shqiptar',
  mother_name: '',
  mother_last_name: '',
  mother_birthday: '',
  father_name: '',
  father_last_name: '',
  guardian_personal_id: '',
  guardian_phone: '',
  guardian_email: '',
  category_id: '',
  contract_number: '',
  generation: ACADEMIC_YEAR,
  class_name: '',
  study_year: 1,
  enrollment_date: dayjs().format('YYYY-MM-DD'),
  yearly_quota: '',
  discount_type: 'none',
  discount_value: '',
  payment_plan: 'monthly',
};

export default function StudentForm({ initial, categories, onSubmit, busy, submitLabel }) {
  // Vlerat NULL nga baza nuk duhet t'i fshijnë vlerat e parazgjedhura
  const [form, setForm] = useState(() => {
    const merged = { ...EMPTY };
    Object.entries(initial || {}).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') merged[k] = v;
    });
    return merged;
  });

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  // ---- Nr. i kontratës: mbushet vetvetiu sipas drejtimit + gjeneratës ----
  const isEdit = Boolean(initial && initial.id);
  const [contractBusy, setContractBusy] = useState(false);
  const reqId = useRef(0);

  const loadContractNumber = (categoryId, generation, enrollmentDate) => {
    if (!categoryId) return;
    const id = ++reqId.current;
    setContractBusy(true);
    fetchNextContractNumber(categoryId, generation, enrollmentDate)
      .then((nr) => {
        // vetëm përgjigjja e fundit vlen (mbrojtje ndaj klikimeve të shpejta)
        if (id === reqId.current && nr) setForm((f) => ({ ...f, contract_number: nr }));
      })
      .catch(() => {})
      .finally(() => {
        if (id === reqId.current) setContractBusy(false);
      });
  };

  // Në regjistrim: rifreskohet sa herë ndryshon drejtimi ose gjenerata.
  // Në ndryshim: numri i lëshuar nuk preket — përdoret butoni ↻.
  useEffect(() => {
    if (isEdit) return undefined;
    const t = setTimeout(
      () => loadContractNumber(form.category_id, form.generation, form.enrollment_date),
      250
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.category_id, form.generation, isEdit]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      discount_value: form.discount_type === 'none' ? 0 : Number(form.discount_value || 0),
      yearly_quota: Number(form.yearly_quota),
      study_year: Number(form.study_year) || 1,
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
          <Field label="Shtetësia">
            <input
              value={form.citizenship ?? ''}
              onChange={set('citizenship')}
              maxLength={60}
              placeholder="Kosovar"
            />
          </Field>
          <Field label="Kombësia">
            <input
              value={form.nationality ?? ''}
              onChange={set('nationality')}
              maxLength={60}
              placeholder="Shqiptar"
            />
          </Field>
          <Field label="Adresa" required span>
            <input value={form.address} onChange={set('address')} required maxLength={160} />
          </Field>
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Kontakti i nxënësit</h2>
        <div className="form-grid">
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
          <Field label="E-mail">
            <input
              type="email"
              value={form.email || ''}
              onChange={set('email')}
              maxLength={120}
              placeholder="emri@email.com"
            />
          </Field>
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Prindërit / Kujdestari ligjor</h2>
        <div className="form-grid">
          <Field label="Emri i nënës" required>
            <input value={form.mother_name} onChange={set('mother_name')} required maxLength={80} />
          </Field>
          <Field label="Mbiemri i nënës">
            <input value={form.mother_last_name || ''} onChange={set('mother_last_name')} maxLength={80} />
          </Field>
          <Field label="Datëlindja e nënës">
            <input type="date" value={form.mother_birthday || ''} onChange={set('mother_birthday')} />
          </Field>
          <Field label="Emri i babait" required>
            <input value={form.father_name} onChange={set('father_name')} required maxLength={80} />
          </Field>
          <Field label="Mbiemri i babait">
            <input value={form.father_last_name || ''} onChange={set('father_last_name')} maxLength={80} />
          </Field>
          <Field label="Nr. personal i prindit">
            <input value={form.guardian_personal_id || ''} onChange={set('guardian_personal_id')} maxLength={20} />
          </Field>
          <Field label="Telefoni i prindit">
            <input
              type="tel"
              value={form.guardian_phone || ''}
              onChange={set('guardian_phone')}
              maxLength={30}
              placeholder="+383 4x xxx xxx"
            />
          </Field>
          <Field label="E-maili i prindit">
            <input
              type="email"
              value={form.guardian_email || ''}
              onChange={set('guardian_email')}
              maxLength={120}
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
          <Field label="Viti i studimit" required>
            <select value={form.study_year} onChange={set('study_year')} required>
              {Object.entries(YEAR_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Paralelja">
            <input value={form.class_name || ''} onChange={set('class_name')} placeholder="p.sh. X/1" />
          </Field>
          <Field label="Data e regjistrimit" required>
            <input type="date" value={form.enrollment_date} onChange={set('enrollment_date')} required />
          </Field>
          <Field label="Nr. i kontratës">
            <span className="field-with-action">
              <input
                value={form.contract_number || ''}
                onChange={set('contract_number')}
                maxLength={30}
                placeholder={contractBusy ? 'Duke gjeneruar…' : 'Zgjidhni drejtimin'}
              />
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() =>
                  loadContractNumber(form.category_id, form.generation, form.enrollment_date)
                }
                disabled={!form.category_id || contractBusy}
                title="Rigjenero numrin e kontratës"
              >
                ↻
              </button>
            </span>
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