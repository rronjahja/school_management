import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout.jsx';
import { useAuth } from './context/AuthContext.jsx';
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
import Ditari from './pages/Ditari.jsx';
import DitariKlasa from './pages/DitariKlasa.jsx';
import Administrata from './pages/Administrata.jsx';
import Oret from './pages/Oret.jsx';
import OretMbajtura from './pages/OretMbajtura.jsx';
import Logs from './pages/Logs.jsx';

/** Rruget e panjohura e cojne perdoruesin te faqja e tij e pare. */
function HomeRedirect() {
  const { home } = useAuth();
  return <Navigate to={home} replace />;
}

/** Faqet brenda aplikacionit — te gjitha kerkojne identifikim. */
function AppRoutes() {
  return (
    <Layout>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute area="dashboard">
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/studentet"
          element={
            <ProtectedRoute area="students">
              <Students />
            </ProtectedRoute>
          }
        />
        <Route
          path="/studentet/regjistro"
          element={
            <ProtectedRoute area="register">
              <RegisterStudent />
            </ProtectedRoute>
          }
        />
        <Route
          path="/studentet/:id"
          element={
            <ProtectedRoute area="students">
              <StudentDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/studentet/:id/ndrysho"
          element={
            <ProtectedRoute area="students">
              <EditStudent />
            </ProtectedRoute>
          }
        />
        <Route
          path="/administrata"
          element={
            <ProtectedRoute area="administrata">
              <Administrata />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ditari"
          element={
            <ProtectedRoute area="ditari">
              <Ditari />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ditari/:id"
          element={
            <ProtectedRoute area="ditari">
              <DitariKlasa />
            </ProtectedRoute>
          }
        />
        <Route
          path="/oret"
          element={
            <ProtectedRoute area="mesimi">
              <Oret />
            </ProtectedRoute>
          }
        />
        <Route
          path="/financat"
          element={
            <ProtectedRoute area="finance">
              <Finance />
            </ProtectedRoute>
          }
        />
        <Route
          path="/te-diplomuarit"
          element={
            <ProtectedRoute area="graduates">
              <Graduates />
            </ProtectedRoute>
          }
        />
        <Route
          path="/oret-e-mbajtura"
          element={
            <ProtectedRoute area="oret_raport">
              <OretMbajtura />
            </ProtectedRoute>
          }
        />
        <Route
          path="/veprimet"
          element={
            <ProtectedRoute area="logs">
              <Logs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cilesimet"
          element={
            <ProtectedRoute area="settings">
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<HomeRedirect />} />
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