import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchCategories } from '../api/meta';
import { fetchStudent, updateStudent } from '../api/students';
import { errorMessage } from '../api/client';
import PageHeader from '../components/ui/PageHeader.jsx';
import StudentForm from '../components/students/StudentForm.jsx';
import Loader from '../components/ui/Loader.jsx';

export default function EditStudent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [categories, setCategories] = useState(null);
  const [student, setStudent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetchCategories(), fetchStudent(id)])
      .then(([cats, s]) => {
        setCategories(cats);
        setStudent(s);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [id]);

  const handleSubmit = async (data) => {
    setBusy(true);
    setError('');
    try {
      await updateStudent(id, data);
      navigate(`/studentet/${id}`);
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
        title="Ndrysho të dhënat"
        subtitle="Nëse ndryshoni kuotën, zbritjen ose planin, këstet rigjenerohen automatikisht"
      />

      {error && <p className="form-error form-error-page">{error}</p>}

      {!categories || !student ? (
        <Loader />
      ) : (
        <div className="card">
          <StudentForm
            initial={student}
            categories={categories}
            onSubmit={handleSubmit}
            busy={busy}
            submitLabel="Ruaj ndryshimet"
          />
        </div>
      )}
    </>
  );
}
