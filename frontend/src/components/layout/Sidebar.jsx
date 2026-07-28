import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import IspeLogo from '../ui/IspeLogo.jsx';
import InvasoftLogo from '../ui/InvasoftLogo.jsx';
import { shortGen, currentSchoolYear } from '../../utils/format';

const NAV = [
  { to: '/', label: 'Paneli', icon: PanelIcon, end: true },
  { to: '/studentet', label: 'Nxënësit', icon: StudentsIcon },
  { to: '/studentet/regjistro', label: 'Regjistrimi', icon: RegisterIcon },
  { to: '/financat', label: 'Financat', icon: FinanceIcon, financeOnly: true },
  { to: '/te-diplomuarit', label: 'Të diplomuarit', icon: GraduateIcon, financeOnly: true },
];

const NAV_BOTTOM = [{ to: '/cilesimet', label: 'Cilësimet', icon: GearIcon, adminOnly: true }];

export default function Sidebar() {
  const { user, isAdmin, isFinance, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/hyrje', { replace: true });
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-plate">
          <IspeLogo height={58} />
        </span>
        <span className="brand-sub">Shkolla e Mesme e Lartë</span>
      </div>

      <nav className="sidebar-nav">
        {NAV.filter((n) => !n.financeOnly || isFinance).map(({ to, label, icon: Icon, end }) => (
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

      <nav className="sidebar-nav sidebar-nav-bottom">
        {NAV_BOTTOM.filter((n) => !n.adminOnly || isAdmin).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {user && (
        <div className="sidebar-user">
          <span className="sidebar-user-avatar">
            {(user.full_name || user.username).slice(0, 1).toUpperCase()}
          </span>
          <span className="sidebar-user-body">
            <strong>{user.full_name}</strong>
            <em>{user.role === 'admin' ? 'Administrator' : 'Staf'}</em>
          </span>
          <button
            type="button"
            className="sidebar-logout"
            onClick={handleSignOut}
            title="Dil nga sistemi"
          >
            <LogoutIcon />
          </button>
        </div>
      )}

      <div className="sidebar-foot">
        <span className="foot-year">Viti shkollor {shortGen(currentSchoolYear())}</span>

        <div className="foot-brand-wrap">
          <a
            className="foot-brand"
            href="https://invasoft.io"
            target="_blank"
            rel="noreferrer"
            title="invasoft.io"
          >
            <InvasoftLogo fluid />
          </a>
        </div>
      </div>
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
      <path d="M4 3h9l3 3v11H4z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 8v5M7.5 10.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function GraduateIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path d="M10 3 19 7l-9 4-9-4z" fill="currentColor" />
      <path
        d="M5 9.5V14c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true">
      <path
        d="M12 3H5a1 1 0 00-1 1v12a1 1 0 001 1h7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M14 7l3 3-3 3M17 10H8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path
        d="M10 6.6a3.4 3.4 0 100 6.8 3.4 3.4 0 000-6.8zm7 3.4c0 .5 0 .9-.1 1.3l1.5 1.1-1.5 2.6-1.8-.6c-.6.5-1.3.9-2 1.2L12.8 18H9.2l-.3-2.4c-.7-.3-1.4-.7-2-1.2l-1.8.6-1.5-2.6L5.1 11a7.6 7.6 0 010-2L3.6 7.9l1.5-2.6 1.8.6c.6-.5 1.3-.9 2-1.2L9.2 2h3.6l.3 2.4c.7.3 1.4.7 2 1.2l1.8-.6 1.5 2.6L16.9 9c.1.4.1.7.1 1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FinanceIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
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