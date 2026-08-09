import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  fetchStudent,
  deleteStudent,
  fetchTemplates,
  downloadDocument,
} from '../api/students';
import { createPayment, deletePayment } from '../api/payments';
import { fetchBanks } from '../api/meta';
import { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import CategoryChip from '../components/ui/CategoryChip.jsx';
import StatCard from '../components/ui/StatCard.jsx';
import Loader from '../components/ui/Loader.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import InstallmentTable from '../components/finance/InstallmentTable.jsx';
import PaymentList from '../components/finance/PaymentList.jsx';
import PaymentModal from '../components/finance/PaymentModal.jsx';
import { downloadPaymentReport } from '../utils/paymentReport';
import ReminderButton from '../components/finance/ReminderButton.jsx';
import { canRemind } from '../utils/reminder';
import { downloadSlipPdf, printSlip, reminderSlipUrl } from '../utils/slip';
import { money, date, PLAN_LABELS, YEAR_LABELS, discountText, classLabel, shortGen, phone } from '../utils/format';

export default function StudentDetail() {
  const { id } = useParams();
  const { isManager, isFinance } = useAuth();
  const navigate = useNavigate();

  const [student, setStudent] = useState(null);
  const [banks, setBanks] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [templateFile, setTemplateFile] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  useEffect(() => {
    fetchStudent(id)
      .then(setStudent)
      .catch((err) => setError(errorMessage(err)));
    // Bankat i duhen vetëm modalit të pagesës — stafi do të merrte 403
    if (isFinance) fetchBanks().then(setBanks).catch(() => { });
    fetchTemplates()
      .then((t) => {
        setTemplates(t);
        const rest = t.filter(
          (x) => !/^(kontrata|vertetim)/i.test(x.file)
        );
        if (rest.length) setTemplateFile(rest[0].file);
      })
      .catch(() => { });
  }, [id]);

  // ---- Fletëpagesa për këstet e zgjedhura ----
  // Si parazgjedhje zgjidhen këstet e vonuara; nëse s'ka, ato afër afatit.
  const [picked, setPicked] = useState(null);
  const [slipBusy, setSlipBusy] = useState('');
  const [slipError, setSlipError] = useState('');

  const unpaid = (student?.finance?.installments || []).filter(
    (i) => Number(i.amount) - Number(i.paid || 0) > 0.004
  );
  const keyOf = (i) => (i.is_carryover ? 0 : Number(i.seq));

  // Rivlerësohet sa herë ndryshojnë të dhënat e nxënësit — pra edhe pas
  // një pagese të re. Këstet e shlyera heqin kutizën e tyre, prandaj
  // zgjedhja e vjetër duhet pastruar; përndryshe mbetej e zgjedhur diçka
  // që s'ekziston më dhe butonat dilnin të çaktivizuar.
  useEffect(() => {
    if (!student) return;
    const open = new Set(unpaid.map(keyOf));
    setPicked((prev) => {
      const kept = new Set([...(prev || [])].filter((k) => open.has(k)));
      if (kept.size) return kept;   // zgjedhja e përdoruesit ruhet nëse vlen ende
      // Përndryshe: kësti i radhës — më i vjetri i papaguar (bartja e para).
      const next = [...unpaid].sort((a, b) => keyOf(a) - keyOf(b))[0];
      return new Set(next ? [keyOf(next)] : []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student]);

  const selected = picked || new Set();
  const togglePick = (key) => {
    setPicked((prev) => {
      const next = new Set(prev || []);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const pickedList = unpaid.filter((i) => selected.has(keyOf(i)));
  const pickedTotal = pickedList.reduce(
    (a, i) => a + (Number(i.amount) - Number(i.paid || 0)),
    0
  );

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

  const slipUrl = () => {
    const keste = pickedList.map(keyOf).sort((a, b) => a - b).join(',');
    return `${reminderSlipUrl(id)}${keste ? `?keste=${keste}` : ''}`;
  };

  const handlePayment = async (data) => {
    setPaymentBusy(true);
    setPaymentError('');
    try {
      const updated = await createPayment(data);
      setStudent(updated);
      // Modali NUK mbyllet: kalon te pamja e suksesit me butonat e
      // fletëpagesës. Id-ja i duhet asaj për ta gjeneruar fletën.
      return updated.last_payment_id || null;
    } catch (err) {
      setPaymentError(errorMessage(err));
      return null;
    } finally {
      setPaymentBusy(false);
    }
  };

  /** Pasqyra financiare si PDF — vizatohet ne shfletues, pa asnje kerkese. */
  const handleReport = () => {
    setNotice('');
    try {
      downloadPaymentReport(student);
    } catch (err) {
      setNotice(`Raporti nuk u krijua dot: ${err.message}`);
    }
  };

  const handleDeletePayment = async (payment) => {
    if (!window.confirm(`Të fshihet pagesa prej ${money(payment.amount)}?`)) return;
    try {
      await deletePayment(payment.id);
      setStudent(await fetchStudent(id));
    } catch (err) {
      setNotice(errorMessage(err));
    }
  };

  const handleDeleteStudent = async () => {
    const name = `${student.first_name} ${student.last_name}`;
    if (!window.confirm(`Të fshihet nxënësi ${name}? Ky veprim nuk kthehet.`)) return;
    try {
      await deleteStudent(id);
      navigate('/studentet');
    } catch (err) {
      setNotice(errorMessage(err));
    }
  };

  /** file = shablloni i kerkuar; pa te merret ai i zgjedhur ne liste. */
  const handleDocument = async (file) => {
    setNotice('');
    try {
      await downloadDocument(id, `${student.first_name} ${student.last_name}`, file || templateFile);
    } catch (err) {
      setNotice(errorMessage(err));
    }
  };

  // Kontrata dhe Vërtetimi kanë butonat e vet, me emër të lexueshëm.
  // Çdo shabllon tjetër i shtuar te backend/templates mbetet te lista.
  const findTemplate = (name) =>
    templates.find((t) => t.file.toLowerCase().startsWith(name));
  const kontrata = findTemplate('kontrata');
  const vertetim = findTemplate('vertetim');
  const namedFiles = new Set([kontrata?.file, vertetim?.file].filter(Boolean));
  const otherTemplates = templates.filter((t) => !namedFiles.has(t.file));

  if (error) return <EmptyState title="Gabim" hint={error} />;
  if (!student) return <Loader />;

  // Serveri s'ia dergon fare financat stafit — prandaj `f` mund te mungoje
  // dhe cdo bllok financiar duhet mbrojtur, jo vetem fshehur.
  const f = student.finance;
  const showFinance = isFinance && Boolean(f);

  return (
    <>
      <PageHeader
        title={`${student.first_name} ${student.last_name}`}
        subtitle={
          <span className="header-chips">
            <CategoryChip name={student.category_name} color={student.category_color} />
            <span className="muted">
              {shortGen(student.generation)} · {YEAR_LABELS[student.study_year] || 'Viti I'}
              {student.class_name ? ` · Paralelja ${classLabel(student.study_year, student.class_name)}` : ''}
            </span>
            {showFinance && <StatusBadge status={f.status} />}
          </span>
        }
      >
        {showFinance && canRemind(f) && <ReminderButton studentId={id} />}
        {kontrata && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => handleDocument(kontrata.file)}
          >
            <ContractIcon />
            Kontrata
          </button>
        )}
        {vertetim && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => handleDocument(vertetim.file)}
          >
            <CertificateIcon />
            Vërtetimi i nxënësit
          </button>
        )}
        {otherTemplates.length > 0 && (
          <span className="doc-generate">
            {otherTemplates.length > 1 && (
              <select
                className="doc-select"
                value={templateFile}
                onChange={(e) => setTemplateFile(e.target.value)}
                aria-label="Zgjidh dokumentin"
              >
                {otherTemplates.map((t) => (
                  <option key={t.file} value={t.file}>
                    {t.label}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => handleDocument(
                otherTemplates.length === 1 ? otherTemplates[0].file : templateFile
              )}
            >
              <ContractIcon />
              {otherTemplates.length === 1 ? otherTemplates[0].label : 'Krijo dokumentin'}
            </button>
          </span>
        )}
        <Link to={`/studentet/${id}/ndrysho`} className="btn btn-ghost">
          Ndrysho
        </Link>
        {isManager && (
          <button type="button" className="btn btn-danger-ghost" onClick={handleDeleteStudent}>
            Fshi
          </button>
        )}
      </PageHeader>

      {notice && <p className="form-error form-error-page">{notice}</p>}

      {showFinance && (
        <div className="stat-grid">
          <StatCard
            label="Kuota neto"
            value={money(f.net_quota)}
            hint={
              student.discount_type !== 'none'
                ? `${money(student.yearly_quota)} − zbritje ${discountText(student.discount_type, student.discount_value)}`
                : `Plani: ${PLAN_LABELS[student.payment_plan]}`
            }
          />
          <StatCard label="Paguar deri tani" value={money(f.total_paid)} tone="green" />
          <StatCard
            label="Borxhi i mbetur"
            value={money(f.balance)}
            tone={f.balance > 0 ? 'amber' : 'green'}
          />
          <StatCard
            label="Kësti i ardhshëm"
            value={f.next_due ? money(f.next_due.amount) : '—'}
            hint={f.next_due ? `Afati: ${date(f.next_due.due_date)}` : 'Të gjitha të paguara'}
            tone={f.status === 'overdue' ? 'red' : f.status === 'due-soon' ? 'amber' : 'default'}
          />
        </div>
      )}

      <div className="detail-columns">
        <section className="card">
          <h2 className="card-title">Të dhënat personale</h2>
          <dl className="info-grid">
            <Info label="Datëlindja" value={date(student.birthday)} />
            <Info
              label="Gjinia"
              value={student.gender === 'm' ? 'Mashkull' : student.gender === 'f' ? 'Femër' : null}
            />
            <Info label="Komuna" value={student.city} />
            <Info label="Adresa" value={student.address} span />
            <Info label="Shtetësia" value={student.citizenship} />
            <Info label="Kombësia" value={student.nationality} />
            <Info label="Telefoni" value={phone(student.phone)} />
            <Info label="E-mail" value={student.email} />
            <Info label="Nr. i kontratës" value={student.contract_number} />
            <Info label="Data e regjistrimit" value={date(student.enrollment_date)} />
            <Info label="Plani i pagesës" value={PLAN_LABELS[student.payment_plan]} />
          </dl>
        </section>

        <section className="card">
          <h2 className="card-title">
            {student.primary_contact === 'guardian' ? 'Kujdestari ligjor' : 'Prindërit'}
          </h2>

          {student.primary_contact === 'guardian' ? (
            /* Kujdestari zevendeson prinderit: nje kolone e vetme */
            <div className="parents-split single">
              <div className="parent-col">
                <div className="parent-col-head">
                  <h3 className="parent-col-title">Kujdestari ligjor</h3>
                  <span className="pick-flag is-on">★ Kontakti i parë</span>
                </div>
                <dl className="parent-facts">
                  <Info label="Emri" value={[student.guardian_name, student.guardian_last_name].filter(Boolean).join(' ')} />
                  <Info label="Telefoni" value={phone(student.guardian_phone)} strong />
                  <Info label="Datëlindja" value={date(student.guardian_birthday)} />
                  <Info label="Nr. personal" value={student.guardian_personal_id} />
                  <Info label="E-mail" value={student.guardian_email} />
                </dl>
              </div>
            </div>
          ) : (
            /* Majtas nena, djathtas babai — si te formulari, qe te mos
               perzihen te dhenat e dy prinderve ne te njejtin rresht */
            <div className="parents-split">
              <div className="parent-col">
                <div className="parent-col-head">
                  <h3 className="parent-col-title">Nëna</h3>
                  {student.primary_contact === 'mother' && (
                    <span className="pick-flag is-on">★ Kontakti i parë</span>
                  )}
                </div>
                <dl className="parent-facts">
                  <Info label="Emri" value={[student.mother_name, student.mother_last_name].filter(Boolean).join(' ')} />
                  <Info
                    label="Telefoni"
                    value={phone(student.mother_phone)}
                    strong={student.primary_contact === 'mother'}
                  />
                  <Info label="Datëlindja" value={date(student.mother_birthday)} />
                  <Info label="Nr. personal" value={student.mother_personal_id} />
                  <Info label="E-mail" value={student.mother_email} />
                </dl>
              </div>

              <div className="parent-col">
                <div className="parent-col-head">
                  <h3 className="parent-col-title">Babai</h3>
                  {student.primary_contact === 'father' && (
                    <span className="pick-flag is-on">★ Kontakti i parë</span>
                  )}
                </div>
                <dl className="parent-facts">
                  <Info label="Emri" value={[student.father_name, student.father_last_name].filter(Boolean).join(' ')} />
                  <Info
                    label="Telefoni"
                    value={phone(student.father_phone)}
                    strong={student.primary_contact === 'father'}
                  />
                  <Info label="Datëlindja" value={date(student.father_birthday)} />
                  <Info label="Nr. personal" value={student.father_personal_id} />
                  <Info label="E-mail" value={student.father_email} />
                </dl>
              </div>
            </div>
          )}
        </section>

        {showFinance && (
          <section className="card">
            <div className="card-title-row">
              <h2 className="card-title">Pagesat</h2>
              <span className="card-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  title="Pasqyra e plotë e pagesave dhe e kësteve, si PDF"
                  onClick={handleReport}
                >
                  <ReportIcon />
                  Pasqyra financiare
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-small"
                  onClick={() => setShowPayment(true)}
                >
                  + Shto pagesë
                </button>
              </span>
            </div>
            <PaymentList
              payments={student.payments}
              finance={f}
              onDelete={isManager ? handleDeletePayment : null}
            />
          </section>
        )}
      </div>

      {showFinance && (
        <section className="card">
          <div className="card-title-row">
            <h2 className="card-title">Këstet</h2>
            {unpaid.length > 0 && (
              <div className="slip-bar">
                <span className="slip-sum">
                  {pickedList.length
                    ? `${pickedList.length} këste · ${money(pickedTotal)}`
                    : 'Zgjidhni këstet'}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  disabled={!pickedList.length || Boolean(slipBusy)}
                  onClick={() => runSlip('pdf', () =>
                    downloadSlipPdf(
                      slipUrl(),
                      `Fletepagesa_${student.first_name}_${student.last_name}.pdf`
                    ))}
                >
                  {slipBusy === 'pdf' ? 'Duke përgatitur…' : 'Fletëpagesa (PDF)'}
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-small"
                  disabled={!pickedList.length || Boolean(slipBusy)}
                  onClick={() => runSlip('print', () => printSlip(slipUrl()))}
                >
                  {slipBusy === 'print' ? 'Duke hapur…' : '🖨 Printo'}
                </button>
              </div>
            )}
          </div>
          {slipError && <p className="form-error">{slipError}</p>}
          <InstallmentTable
            installments={f.installments}
            selected={selected}
            onToggle={unpaid.length ? togglePick : undefined}
          />
        </section>
      )}

      {showPayment && showFinance && (
        <PaymentModal
          student={student}
          banks={banks}
          busy={paymentBusy}
          error={paymentError}
          onClose={() => {
            setShowPayment(false);
            setPaymentError('');
          }}
          onSubmit={handlePayment}
        />
      )}
    </>
  );
}

function Info({ label, value, span, strong }) {
  return (
    <div className={`info-item${span ? ' info-span' : ''}`}>
      <dt>{label}</dt>
      <dd className={strong ? 'is-primary' : undefined}>{value || '—'}</dd>
    </div>
  );
}

/** Dokument me faqe të palosur — ikona e kontratës. */
/** Vërtetimi — fletë me vulë, që të dallohet nga kontrata. */
function CertificateIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 2.75h14v12.5H5V2.75Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M8 6.5h8M8 9.5h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="17.5" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M10.4 20.1 9.5 23l2.5-1.3 2.5 1.3-.9-2.9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Pasqyra financiare — nje flete me rreshta dhe nje shenje euro. */
function ReportIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5.5 2.75h9l4 4v14.5h-13z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" stroke="currentColor"
        strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14.5 2.75v4h4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function ContractIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 2.75h7.2L19 8.5v12.75H6V2.75Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M13 2.9V9h5.9" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path
        d="M9 13h7M9 16.5h7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}