import { useNavigate } from 'react-router-dom';

export default function BackButton({ to = '/', label = 'Mbrapa' }) {
  const navigate = useNavigate();

  const goBack = () => {
    const idx = window.history.state && window.history.state.idx;
    if (typeof idx === 'number' && idx > 0) navigate(-1);
    else navigate(to);
  };

  return (
    <button type="button" className="btn btn-back" onClick={goBack}>
      <span className="btn-back-arrow" aria-hidden="true">‹</span>
      {label}
    </button>
  );
}