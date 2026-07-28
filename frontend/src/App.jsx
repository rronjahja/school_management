import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout.jsx';
import ProtectedRoute from './components/auth/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Students from './pages/Students.jsx';
import RegisterStudent from './pages/RegisterStudent.jsx';
import EditStudent from './pages/EditStudent.jsx';
import StudentDetail from './pages/StudentDetail.jsx';
import Finance from './pages/Finance.jsx';
import Graduates from './pages/Graduates.jsx';
import Settings from './pages/Settings.jsx';

/** Faqet brenda aplikacionit — te gjitha kerkojne identifikim. */
function AppRoutes() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/studentet" element={<Students />} />
        <Route path="/studentet/regjistro" element={<RegisterStudent />} />
        <Route path="/studentet/:id" element={<StudentDetail />} />
        <Route path="/studentet/:id/ndrysho" element={<EditStudent />} />
        <Route
          path="/financat"
          element={
            <ProtectedRoute financeOnly>
              <Finance />
            </ProtectedRoute>
          }
        />
        <Route
          path="/te-diplomuarit"
          element={
            <ProtectedRoute financeOnly>
              <Graduates />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cilesimet"
          element={
            <ProtectedRoute adminOnly>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/hyrje" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppRoutes />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}