import { useEffect, useRef, useState } from 'react';

export default function StatCard({ label, value, hint, tone = 'default', secret = false }) {
  const [shown, setShown] = useState(false);
  const holding = useRef(false);

  useEffect(() => {
    if (!secret) return undefined;

    const release = () => {
      if (!holding.current) return;
      holding.current = false;
      setShown(false);
    };

    window.addEventListener('mouseup', release);
    window.addEventListener('touchend', release);
    window.addEventListener('touchcancel', release);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('mouseup', release);
      window.removeEventListener('touchend', release);
      window.removeEventListener('touchcancel', release);
      window.removeEventListener('blur', release);
    };
  }, [secret]);

  const hold = (e) => {
    e.preventDefault();
    holding.current = true;
    setShown(true);
  };

  if (!secret) {
    return (
      <div className={`stat-card stat-${tone}`}>
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
        {hint && <span className="stat-hint">{hint}</span>}
      </div>
    );
  }

  return (
    <div className={`stat-card stat-${tone}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value stat-secret-row">
        <span className={shown ? undefined : 'stat-masked'}>
          {shown ? value : '••••••'}
        </span>
        <button
          type="button"
          className={`stat-eye${shown ? ' is-on' : ''}`}
          aria-label={shown ? 'Fsheh shumën' : 'Mbaje shtypur për ta parë shumën'}
          title="Mbaje shtypur për ta parë"
          onMouseDown={hold}
          onTouchStart={hold}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setShown(true); }
          }}
          onKeyUp={(e) => {
            if (e.key === ' ' || e.key === 'Enter') setShown(false);
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {shown ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </span>
      {hint && <span className="stat-hint">{shown ? hint : '\u00a0'}</span>}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 12S6 5.5 12 5.5c1.6 0 3 .45 4.2 1.1M21.5 12S18 18.5 12 18.5c-1.6 0-3-.45-4.2-1.1"
        stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 20 20 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}