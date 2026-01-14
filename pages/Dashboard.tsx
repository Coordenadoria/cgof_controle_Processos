
import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Componente Dashboard desativado conforme solicitação do usuário.
 * Redireciona automaticamente para a gestão de processos.
 */
export const Dashboard = () => {
  return <Navigate to="/processos" replace />;
};
