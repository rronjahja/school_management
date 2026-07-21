import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCategories } from '../api/meta';
import { createStudent } from '../api/students';
import { errorMessage } from '../api/client';
import PageHeader from '../components/ui/PageHeader.jsx';
import StudentForm from '../components/students/StudentForm.jsx';
import Loader from '../components/ui/Loader.jsx';

const PREFILL_KEY = 'ispe_import_prefill';

export default function RegisterStudent() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Parambushja nga "Migrimi i kontratave" (Cilësimet). Lexohet një herë
  // dhe hiqet menjëherë, që rifreskimi i faqes të japë formular të pastër.
  // KUJDES: çelësi NUK hiqet brenda inicializuesit — StrictMode i React-ut
  // i ekzekuton inicializuesit dy herë në zhvillim, dhe hapja e dytë do ta
  // gjente të zbrazët. Heqja bëhet pas montimit, te useEffect-i më poshtë.
  const [imported] = useState(() => {
    try {
      const raw = sessionStorage.getItem(PREFILL_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  useEffect(() => {
    sessionStorage.removeItem(PREFILL_KEY);
  }, []);

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const handleSubmit = async (data) => {
    setBusy(true);
    setError('');
    try {
      const student = await createStudent(data);
      navigate(`/studentet/${student.id}`);
    } catch (err) {
      setError(errorMessage(err));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Regjistrimi i nxënësit"
        subtitle="Plotësoni të dhënat — këstet gjenerohen automatikisht sipas planit të pagesës"
      />

      {imported && (
        <div className="import-banner">
          <strong>Të dhënat u plotësuan nga kontrata:</strong> {imported.filename}
          {imported.warnings?.length > 0 && (
            <ul>{imported.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          )}
        </div>
      )}

      {error && <p className="form-error form-error-page">{error}</p>}

      {!categories ? (
        <Loader />
      ) : (
        <div className="card">
          <StudentForm
            initial={imported ? imported.prefill : undefined}
            categories={categories}
            onSubmit={handleSubmit}
            busy={busy}
            submitLabel="Regjistro nxënësin"
          />
        </div>
      )}
    </>
  );
}