import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Students from './pages/Students.jsx';
import RegisterStudent from './pages/RegisterStudent.jsx';
import EditStudent from './pages/EditStudent.jsx';
import StudentDetail from './pages/StudentDetail.jsx';
import Finance from './pages/Finance.jsx';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/studentet" element={<Students />} />
        <Route path="/studentet/regjistro" element={<RegisterStudent />} />
        <Route path="/studentet/:id" element={<StudentDetail />} />
        <Route path="/studentet/:id/ndrysho" element={<EditStudent />} />
        <Route path="/financat" element={<Finance />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
