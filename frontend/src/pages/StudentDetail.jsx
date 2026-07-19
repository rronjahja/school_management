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
import PageHeader from '../components/ui/PageHeader.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import CategoryChip from '../components/ui/CategoryChip.jsx';
import StatCard from '../components/ui/StatCard.jsx';
import Loader from '../components/ui/Loader.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import InstallmentTable from '../components/finance/InstallmentTable.jsx';
import PaymentList from '../components/finance/PaymentList.jsx';
import PaymentModal from '../components/finance/PaymentModal.jsx';
import { money, date, PLAN_LABELS, YEAR_LABELS, discountText } from '../utils/format';

export default function StudentDetail() {
  const { id } = useParams();
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
    fetchBanks().then(setBanks).catch(() => {});
    fetchTemplates()
      .then((t) => {
        setTemplates(t);
        if (t.length) setTemplateFile(t[0].file);
      })
      .catch(() => {});
  }, [id]);

  const handlePayment = async (data) => {
    setPaymentBusy(true);
    setPaymentError('');
    try {
      const updated = await createPayment(data);
      setStudent(updated);
      setShowPayment(false);
    } catch (err) {
      setPaymentError(errorMessage(err));
    } finally {
      setPaymentBusy(false);
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
    if (!window.confirm(`Të fshihet studenti ${name}? Ky veprim nuk kthehet.`)) return;
    try {
      await deleteStudent(id);
      navigate('/studentet');
    } catch (err) {
      setNotice(errorMessage(err));
    }
  };

  const handleDocument = async () => {
    setNotice('');
    try {
      await downloadDocument(id, `${student.first_name} ${student.last_name}`, templateFile);
    } catch (err) {
      setNotice(errorMessage(err));
    }
  };

  if (error) return <EmptyState title="Gabim" hint={error} />;
  if (!student) return <Loader />;

  const f = student.finance;

  return (
    <>
      <PageHeader
        title={`${student.first_name} ${student.last_name}`}
        subtitle={
          <span className="header-chips">
            <CategoryChip name={student.category_name} color={student.category_color} />
            <span className="muted">
              {student.generation} · {YEAR_LABELS[student.study_year] || 'Viti I'}
              {student.class_name ? ` · Klasa ${student.class_name}` : ''}
            </span>
            <StatusBadge status={f.status} />
          </span>
        }
      >
        <span className="doc-generate">
          {templates.length > 1 && (
            <select
              className="doc-select"
              value={templateFile}
              onChange={(e) => setTemplateFile(e.target.value)}
              aria-label="Zgjidh dokumentin"
            >
              {templates.map((t) => (
                <option key={t.file} value={t.file}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
          <button type="button" className="btn btn-ghost" onClick={handleDocument}>
            ⬇ {templates.length === 1 ? `Gjenero: ${templates[0].label}` : 'Gjenero dokumentin'}
          </button>
        </span>
        <Link to={`/studentet/${id}/ndrysho`} className="btn btn-ghost">
          Ndrysho
        </Link>
        <button type="button" className="btn btn-danger-ghost" onClick={handleDeleteStudent}>
          Fshi
        </button>
      </PageHeader>

      {notice && <p className="form-error form-error-page">{notice}</p>}

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

      <div className="detail-columns">
        <section className="card">
          <h2 className="card-title">Të dhënat personale</h2>
          <dl className="info-grid">
            <Info label="Datëlindja" value={date(student.birthday)} />
            <Info label="Qyteti" value={student.city} />
            <Info label="Adresa" value={student.address} span />
            <Info label="Shtetësia" value={student.citizenship} />
            <Info label="Kombësia" value={student.nationality} />
            <Info label="Telefoni" value={student.phone} />
            <Info label="E-mail" value={student.email} />
            <Info label="Nr. i kontratës" value={student.contract_number} />
            <Info label="Data e regjistrimit" value={date(student.enrollment_date)} />
            <Info label="Plani i pagesës" value={PLAN_LABELS[student.payment_plan]} />
          </dl>
        </section>

        <section className="card">
          <h2 className="card-title">Prindërit / Kujdestari</h2>
          <dl className="info-grid">
            <Info
              label="Nëna"
              value={[student.mother_name, student.mother_last_name].filter(Boolean).join(' ')}
            />
            <Info label="Datëlindja e nënës" value={date(student.mother_birthday)} />
            <Info
              label="Babai"
              value={[student.father_name, student.father_last_name].filter(Boolean).join(' ')}
            />
            <Info label="Nr. personal" value={student.guardian_personal_id} />
            <Info label="Telefoni i prindit" value={student.guardian_phone} />
            <Info label="E-maili i prindit" value={student.guardian_email} />
          </dl>
        </section>

        <section className="card">
          <div className="card-title-row">
            <h2 className="card-title">Pagesat</h2>
            <button type="button" className="btn btn-primary btn-small" onClick={() => setShowPayment(true)}>
              + Shto pagesë
            </button>
          </div>
          <PaymentList payments={student.payments} onDelete={handleDeletePayment} />
        </section>
      </div>

      <section className="card">
        <h2 className="card-title">Këstet</h2>
        <InstallmentTable installments={f.installments} />
      </section>

      {showPayment && (
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

function Info({ label, value, span }) {
  return (
    <div className={`info-item${span ? ' info-span' : ''}`}>
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  );
}