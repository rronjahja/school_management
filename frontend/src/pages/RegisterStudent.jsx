import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCategories } from '../api/meta';
import { createStudent } from '../api/students';
import { errorMessage } from '../api/client';
import PageHeader from '../components/ui/PageHeader.jsx';
import StudentForm from '../components/students/StudentForm.jsx';
import Loader from '../components/ui/Loader.jsx';

export default function RegisterStudent() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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

      {error && <p className="form-error form-error-page">{error}</p>}

      {!categories ? (
        <Loader />
      ) : (
        <div className="card">
          <StudentForm
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