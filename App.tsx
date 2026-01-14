
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { ProcessManager } from './pages/ProcessManager';
import { UserManagement } from './pages/UserManagement';
import { Logs } from './pages/Logs';
import { Login } from './pages/Login';
import { Profile } from './pages/Profile';
import { UserRole } from './types';

const ProtectedRoute = ({ children, adminOnly = false }: { children?: React.ReactNode, adminOnly?: boolean }) => {
  const { currentUser } = useApp();
  
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && currentUser.role !== UserRole.ADMIN) {
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
};

const AppRoutes = () => {
  const { currentUser } = useApp();

  return (
    <Routes>
      <Route path="/login" element={currentUser ? <Navigate to="/" /> : <Login />} />
      
      <Route path="/" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      
      <Route path="/processos" element={
        <ProtectedRoute>
          <ProcessManager />
        </ProtectedRoute>
      } />

      <Route path="/perfil" element={
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      } />
      
      <Route path="/usuarios" element={
        <ProtectedRoute adminOnly>
          <UserManagement />
        </ProtectedRoute>
      } />
      
      <Route path="/logs" element={
        <ProtectedRoute adminOnly>
          <Logs />
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AppProvider>
  );
}
