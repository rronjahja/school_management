import { Link } from 'react-router-dom';

/** Banderola e faqes kryesore — pa logo, vetëm titulli dhe veprimi kryesor. */
import { currentSchoolYear, shortGen } from '../../utils/format';

export default function HomeHero({ generation, studentCount }) {
  const shown = shortGen(generation || currentSchoolYear());
  return (
    <section className="hero">
      <div className="hero-identity">
        <span className="hero-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <path
              d="M4 4h7v9H4zM13 4h7v6h-7zM13 12h7v8h-7zM4 15h7v5H4z"
              fill="currentColor"
            />
          </svg>
        </span>

        <div className="hero-copy">
          <p className="hero-eyebrow">Shkolla e Mesme e Lartë Profesionale</p>
          <h1 className="hero-title">Paneli i menaxhimit</h1>
          <p className="hero-sub">
            Viti shkollor {shown}
            {typeof studentCount === 'number' && ` · ${studentCount} nxënës`}
          </p>
        </div>
      </div>

      <Link to="/studentet/regjistro" className="btn btn-on-dark">
        + Regjistro student
      </Link>
    </section>
  );
}