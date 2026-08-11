import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import Field from '../ui/Field.jsx';
import DateInput from '../ui/DateInput.jsx';
import { fetchNextContractNumber } from '../../api/students';
import FinancePreview from './FinancePreview.jsx';
import { DISCOUNT_LABELS, PLAN_LABELS, YEAR_LABELS, YEAR_ROMAN, defaultRegistrationGeneration } from '../../utils/format';

const EMPTY = {
  first_name: '',
  last_name: '',
  birthday: '',
  gender: '',
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
  mother_phone: '',
  mother_personal_id: '',
  mother_email: '',
  father_phone: '',
  father_birthday: '',
  father_personal_id: '',
  father_email: '',
  guardian_name: '',
  guardian_last_name: '',
  guardian_phone: '',
  guardian_birthday: '',
  guardian_personal_id: '',
  guardian_gender: '',
  guardian_email: '',
  primary_contact: 'father',
  category_id: '',
  contract_number: '',
  is_transfer: false,
  generation: defaultRegistrationGeneration(),
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

  // Kujdestari ligjor nuk mbahet si fushe e vecante: 'guardian' te
  // primary_contact eshte i vetmi burim i se vertetes.
  const hasGuardian = form.primary_contact === 'guardian';

  // Numri personal kerkohet VETEM per kontaktin e pare — ai person nenshkruan
  // kontraten. Ylli levize vetvetiu kur nderrohet kontakti, qe forma te mos
  // kerkoje nje fushe qe s'duket me e detyrueshme.
  const isPrimary = (who) => form.primary_contact === who;

  // ---- Nr. i kontratës: mbushet vetvetiu sipas drejtimit + gjeneratës ----
  const isEdit = Boolean(initial && initial.id);
  // Kontrata e migruar sjell numrin e VET — gjenerimi automatik nuk e prek
  const isImported = Boolean(initial && !initial.id && initial.contract_number);
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
      .catch(() => { })
      .finally(() => {
        if (id === reqId.current) setContractBusy(false);
      });
  };

  // Në regjistrim: rifreskohet sa herë ndryshon drejtimi ose gjenerata.
  // Në ndryshim: numri i lëshuar nuk preket — përdoret butoni ↻.
  useEffect(() => {
    if (isEdit || isImported) return undefined;
    const t = setTimeout(
      () => loadContractNumber(form.category_id, form.generation, form.enrollment_date),
      250
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.category_id, form.generation, isEdit, isImported]);

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

  // Kuota vjetore vjen nga konfigurimi i drejtimit (Cilësimet), jo nga shkrimi me dorë.
  const selectedCategory = categoryOptions.find(
    (c) => String(c.id) === String(form.category_id)
  );
  const importedQuota = Boolean(initial && initial.quota_override);
  const quotaLocked =
    !importedQuota &&
    selectedCategory != null &&
    selectedCategory.default_quota !== null &&
    selectedCategory.default_quota !== undefined;

  /**
   * Kur ndryshon drejtimi, kuota merret nga konfigurimi i tij.
   * E rendesishme: kjo ndodh VETEM me nje ndryshim te vertete nga perdoruesi —
   * hapja e formularit per nje nxenes ekzistues nuk ia prek kuoten.
   */
  const setCategory = (e) => {
    const id = e.target.value;
    const cat = categoryOptions.find((c) => String(c.id) === String(id));
    const hasQuota =
      cat && cat.default_quota !== null && cat.default_quota !== undefined;

    // Nese drejtimi i ri s'ka kuote te caktuar, fusha zbrazet — qe te mos
    // mbetet aty vlera e drejtimit te meparshem dhe te ruhet pa u vene re.
    setForm((f) => ({
      ...f,
      category_id: id,
      yearly_quota: hasQuota ? String(cat.default_quota) : '',
    }));
  };

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
            <DateInput value={form.birthday} onChange={set('birthday')} required />
          </Field>
          <Field label="Gjinia">
            <div className="seg" role="radiogroup" aria-label="Gjinia">
              <button
                type="button"
                role="radio"
                aria-checked={form.gender === 'm'}
                className={`seg-opt${form.gender === 'm' ? ' is-on' : ''}`}
                onClick={() => setForm((f) => ({ ...f, gender: f.gender === 'm' ? '' : 'm' }))}
              >
                Mashkull
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={form.gender === 'f'}
                className={`seg-opt${form.gender === 'f' ? ' is-on' : ''}`}
                onClick={() => setForm((f) => ({ ...f, gender: f.gender === 'f' ? '' : 'f' }))}
              >
                Femër
              </button>
            </div>
          </Field>
          <Field label="Komuna" required>
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
          <Field label="Adresa" required>
            <input value={form.address} onChange={set('address')} required maxLength={160} />
          </Field>
          <Field label="Numri i telefonit">
            <input
              type="tel"
              value={form.phone || ''}
              onChange={set('phone')}
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
        <div className="section-head-row">
          <h2 className="form-section-title">
            {hasGuardian ? 'Kujdestari ligjor' : 'Prindërit'}
          </h2>
          <label className="mini-check">
            <input
              type="checkbox"
              checked={hasGuardian}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  primary_contact: e.target.checked ? 'guardian' : 'father',
                }))
              }
            />
            <span>Nxënësi ka kujdestar ligjor</span>
          </label>
        </div>

        {hasGuardian ? (
          /* Kujdestari zevendeson prinderit dhe eshte kontakti i pare */
          <div className="parents-split single">
            <div className="parent-col">
              <div className="parent-col-head">
                <h3 className="parent-col-title">Kujdestari ligjor</h3>
                <span className="pick-flag is-on" title="Kontakti i parë">
                  ★ Kontakti i parë
                </span>
              </div>
              <Field label="Emri" required>
                <input
                  value={form.guardian_name || ''}
                  onChange={set('guardian_name')}
                  maxLength={80}
                  required
                />
              </Field>
              <Field label="Mbiemri">
                <input value={form.guardian_last_name || ''} onChange={set('guardian_last_name')} maxLength={80} />
              </Field>
              <Field label="Telefoni">
                <input
                  type="tel"
                  value={form.guardian_phone || ''}
                  onChange={set('guardian_phone')}
                  maxLength={40}
                  placeholder="+383 4x xxx xxx"
                />
              </Field>
              <Field label="Datëlindja">
                <DateInput value={form.guardian_birthday || ''} onChange={set('guardian_birthday')} />
              </Field>
              <Field label="Numri personal" required hint="Kërkohet për kontaktin e parë.">
                <input
                  value={form.guardian_personal_id || ''}
                  onChange={set('guardian_personal_id')}
                  maxLength={20}
                  inputMode="numeric"
                  required
                />
              </Field>
              <Field label="Gjinia" hint="Përcakton përshëndetjen: z. ose znj.">
                <div className="seg" role="radiogroup" aria-label="Gjinia e kujdestarit">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={form.guardian_gender === 'm'}
                    className={`seg-opt${form.guardian_gender === 'm' ? ' is-on' : ''}`}
                    onClick={() => setForm((f) => ({ ...f, guardian_gender: f.guardian_gender === 'm' ? '' : 'm' }))}
                  >
                    Mashkull
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={form.guardian_gender === 'f'}
                    className={`seg-opt${form.guardian_gender === 'f' ? ' is-on' : ''}`}
                    onClick={() => setForm((f) => ({ ...f, guardian_gender: f.guardian_gender === 'f' ? '' : 'f' }))}
                  >
                    Femër
                  </button>
                </div>
              </Field>
              <Field label="E-mail">
                <input
                  type="email"
                  value={form.guardian_email || ''}
                  onChange={set('guardian_email')}
                  maxLength={120}
                  placeholder="emri@email.com"
                />
              </Field>
            </div>
          </div>
        ) : (
          <div className="parents-split">
            <div className="parent-col">
              <div className="parent-col-head">
                <h3 className="parent-col-title">Nëna</h3>
                <button
                  type="button"
                  className={`pick-flag${form.primary_contact === 'mother' ? ' is-on' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, primary_contact: 'mother' }))}
                  title="Kontakti i parë — përdoret te mesazhet e rikujtesës"
                  aria-pressed={form.primary_contact === 'mother'}
                >
                  ★ Kontakti i parë
                </button>
              </div>
              <Field label="Emri">
                <input value={form.mother_name || ''} onChange={set('mother_name')} maxLength={80} />
              </Field>
              <Field label="Mbiemri">
                <input value={form.mother_last_name || ''} onChange={set('mother_last_name')} maxLength={80} />
              </Field>
              <Field label="Telefoni">
                <input
                  type="tel"
                  value={form.mother_phone || ''}
                  onChange={set('mother_phone')}
                  maxLength={40}
                  placeholder="+383 4x xxx xxx"
                />
              </Field>
              <Field label="Datëlindja">
                <DateInput value={form.mother_birthday || ''} onChange={set('mother_birthday')} />
              </Field>
              <Field
                label="Numri personal"
                required={isPrimary('mother')}
                hint={isPrimary('mother') ? 'Kërkohet për kontaktin e parë.' : undefined}
              >
                <input
                  value={form.mother_personal_id || ''}
                  onChange={set('mother_personal_id')}
                  maxLength={20}
                  inputMode="numeric"
                  required={isPrimary('mother')}
                />
              </Field>
              <Field label="E-mail">
                <input
                  type="email"
                  value={form.mother_email || ''}
                  onChange={set('mother_email')}
                  maxLength={120}
                  placeholder="emri@email.com"
                />
              </Field>
            </div>

            <div className="parent-col">
              <div className="parent-col-head">
                <h3 className="parent-col-title">Babai</h3>
                <button
                  type="button"
                  className={`pick-flag${form.primary_contact === 'father' ? ' is-on' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, primary_contact: 'father' }))}
                  title="Kontakti i parë — përdoret te mesazhet e rikujtesës"
                  aria-pressed={form.primary_contact === 'father'}
                >
                  ★ Kontakti i parë
                </button>
              </div>
              <Field label="Emri">
                <input value={form.father_name || ''} onChange={set('father_name')} maxLength={80} />
              </Field>
              <Field label="Mbiemri">
                <input value={form.father_last_name || ''} onChange={set('father_last_name')} maxLength={80} />
              </Field>
              <Field label="Telefoni">
                <input
                  type="tel"
                  value={form.father_phone || ''}
                  onChange={set('father_phone')}
                  maxLength={40}
                  placeholder="+383 4x xxx xxx"
                />
              </Field>
              <Field label="Datëlindja">
                <DateInput value={form.father_birthday || ''} onChange={set('father_birthday')} />
              </Field>
              <Field
                label="Numri personal"
                required={isPrimary('father')}
                hint={isPrimary('father') ? 'Kërkohet për kontaktin e parë.' : undefined}
              >
                <input
                  value={form.father_personal_id || ''}
                  onChange={set('father_personal_id')}
                  maxLength={20}
                  inputMode="numeric"
                  required={isPrimary('father')}
                />
              </Field>
              <Field label="E-mail">
                <input
                  type="email"
                  value={form.father_email || ''}
                  onChange={set('father_email')}
                  maxLength={120}
                  placeholder="emri@email.com"
                />
              </Field>
            </div>
          </div>
        )}

      </section>

      <section className="form-section">
        <h2 className="form-section-title">Shkollimi</h2>
        <div className="form-grid">
          <Field label="Drejtimi" required>
            <select value={form.category_id} onChange={setCategory} required>
              <option value="">Zgjidhni drejtimin…</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Gjenerata" required>
            <input value={form.generation} onChange={set('generation')} required placeholder={defaultRegistrationGeneration()} />
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
          <Field label="Paralelja" hint="Opsionale — lëreni bosh nëse ende s'është caktuar.">
            <span className="parallel-input">
              <span className="parallel-prefix">
                {YEAR_ROMAN[Number(form.study_year)] || '—'}/
              </span>
              {/*
                Fusha eshte TEKST, jo `type="number"`. Nje fushe numerike e
                bllokon ruajtjen e gjithe formularit kur permbajtja s'i pelqen
                shfletuesit (hapesire e mbetur, «1.», «e», minus) — edhe pa
                `required`. Perdoruesi sheh vetem nje flluske te vogel dhe
                mendon se fusha eshte e detyrueshme.
                Ketu pranohen vetem shifra, dhe formati kontrollohet serish
                ne server.
              */}
              <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                value={form.class_name || ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, class_name: e.target.value.replace(/\D/g, '') }))
                }
                placeholder="1"
              />
            </span>
          </Field>
          <Field label="Data e regjistrimit" required>
            <DateInput value={form.enrollment_date} onChange={set('enrollment_date')} required />
          </Field>
          <Field
            label="Transfer"
            hint="Nxënës i ardhur nga një shkollë tjetër. Shfaqet te titulli i kontratës."
          >
            <label className="mini-check">
              <input
                type="checkbox"
                checked={Boolean(Number(form.is_transfer))}
                onChange={(e) => setForm((f) => ({ ...f, is_transfer: e.target.checked }))}
              />
              <span>Nxënësi është transfer</span>
            </label>
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
          <Field
            label="Kuota vjetore (€)"
            required
            hint={
              quotaLocked
                ? 'Merret nga drejtimi i zgjedhur. Ndryshohet te Cilësimet → Konfigurimet.'
                : importedQuota
                  ? 'Çmimi i kontratës së migruar — ka përparësi ndaj kuotës së drejtimit.'
                  : 'Ky drejtim s’ka kuotë të caktuar te Cilësimet — shkruajeni me dorë.'
            }
          >
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.yearly_quota}
              onChange={set('yearly_quota')}
              required
              readOnly={quotaLocked}
              className={quotaLocked ? 'is-locked' : undefined}
              placeholder="p.sh. 1500"
              title={quotaLocked ? 'Kuota përcaktohet nga drejtimi' : undefined}
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