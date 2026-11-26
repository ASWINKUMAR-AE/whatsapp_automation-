import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import DashboardPage from './pages/DashboardPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/subscription" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          <Route path="/register" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
