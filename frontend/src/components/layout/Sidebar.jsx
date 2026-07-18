import { NavLink } from 'react-router-dom';

const NAV = [
  { to: '/', label: 'Paneli', icon: PanelIcon, end: true },
  { to: '/studentet', label: 'Studentët', icon: StudentsIcon },
  { to: '/studentet/regjistro', label: 'Regjistrimi', icon: RegisterIcon },
  { to: '/financat', label: 'Financat', icon: FinanceIcon },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">ISPE</span>
        <span className="brand-sub">Shkolla e Mesme e Lartë</span>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end || to === '/studentet'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-foot">Viti shkollor 2025/2026</div>
    </aside>
  );
}

/* Ikona te thjeshta inline (pa librari shtese) */
function PanelIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path
        d="M3 3h6v8H3zM11 3h6v5h-6zM11 10h6v7h-6zM3 13h6v4H3z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  );
}

function StudentsIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <circle cx="10" cy="6.5" r="3.2" fill="currentColor" />
      <path d="M3.5 17c.7-3.3 3.3-5 6.5-5s5.8 1.7 6.5 5z" fill="currentColor" />
    </svg>
  );
}

function RegisterIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path
        d="M4 3h9l3 3v11H4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M10 8v5M7.5 10.5h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FinanceIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <circle
        cx="10"
        cy="10"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M12.4 7.8c-.5-.7-1.4-1.1-2.4-1.1-1.5 0-2.6.8-2.6 1.9 0 2.6 5.3 1.2 5.3 3.7 0 1.1-1.2 1.9-2.7 1.9-1.1 0-2-.4-2.5-1.2M10 5.4v9.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
