import Sidebar from './Sidebar.jsx';

export default function Layout({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">{children}</main>
    </div>
  );
}
