import { initials } from '../../utils/format';

/**
 * Ikona e profilit sipas gjinise: silueta femerore per vajzat,
 * mashkullore per djemte.
 *
 * Kur gjinia nuk eshte e regjistruar (nxenesit e vjeter), kthehemi te
 * inicialet — me mire nje shenje e sakte se nje ikone qe merr me mend
 * gjinine gabim.
 */
function GirlIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {/* Flokë të gjatë: një masë e vetme që kalon mbi kokë dhe zbret
          poshtë nga të dyja anët, deri te supet — silueta klasike. */}
      <path
        d="M12 2.6c-4.05 0-6.75 2.85-6.75 6.75 0 2.05-.2 3.85-.52 5.2-.18.78.4 1.52 1.2 1.52h1.3c.66 0 1.2-.5 1.26-1.16.12-1.3.19-2.8.19-4.45 0-1.75 1.5-2.85 3.32-2.85s3.32 1.1 3.32 2.85c0 1.65.07 3.15.19 4.45.06.66.6 1.16 1.26 1.16h1.3c.8 0 1.38-.74 1.2-1.52-.32-1.35-.52-3.15-.52-5.2 0-3.9-2.7-6.75-6.75-6.75Z"
        fill="currentColor"
      />
      {/* Fytyra */}
      <circle cx="12" cy="9.4" r="3.7" fill="currentColor" />
      {/* Supet */}
      <path
        d="M12 14.6c-3.45 0-6.28 2.1-6.92 5.02-.2.9.5 1.75 1.43 1.75h10.98c.93 0 1.63-.85 1.43-1.75-.64-2.92-3.47-5.02-6.92-5.02Z"
        fill="currentColor"
      />
    </svg>
  );
}

function BoyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {/* Koka — pa flokë anash, prandaj dallohet nga silueta femërore */}
      <circle cx="12" cy="7.7" r="3.6" fill="currentColor" />
      {/* Supet */}
      <path
        d="M12 13.9c-3.45 0-6.28 2.08-6.92 4.98-.2.9.5 1.74 1.43 1.74h10.98c.93 0 1.63-.84 1.43-1.74-.64-2.9-3.47-4.98-6.92-4.98Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function Avatar({ student, size }) {
  const { gender, first_name: first, last_name: last, category_color: color } = student || {};

  const style = { '--avatar-color': color };
  if (size) style.width = style.height = `${size}px`;

  if (gender === 'f' || gender === 'm') {
    return (
      <span
        className="avatar avatar-icon"
        style={style}
        title={`${first || ''} ${last || ''}`.trim()}
      >
        {gender === 'f' ? <GirlIcon /> : <BoyIcon />}
      </span>
    );
  }

  // Pa gjini te regjistruar — inicialet si me pare
  return (
    <span className="avatar" style={style} title={`${first || ''} ${last || ''}`.trim()}>
      {initials(first, last)}
    </span>
  );
}