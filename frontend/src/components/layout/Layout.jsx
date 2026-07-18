import Sidebar from './Sidebar.jsx';
import AppFooter from './AppFooter.jsx';

export default function Layout({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className="app-content">{children}</div>
        <AppFooter />
      </main>
    </div>
  );
}