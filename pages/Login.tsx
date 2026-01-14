import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Loader2, Lock, User, AlertCircle } from 'lucide-react';

export const Login = () => {
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const LogoImage = "https://upload.wikimedia.org/wikipedia/commons/1/1a/Bras%C3%A3o_do_estado_de_S%C3%A3o_Paulo.svg";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
        setError("Por favor, preencha todos os campos.");
        return;
    }

    setIsSubmitting(true);
    
    try {
      const success = await login(email, password);
      if (!success) {
        setError('Credenciais inválidas ou usuário inativo.');
      }
    } catch (err) {
      setError('Erro ao conectar com o banco de dados. Tente novamente.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-sm w-full border border-slate-200">
        <div className="flex flex-col items-center mb-6">
          <div className="mb-4">
             <img 
               src={LogoImage} 
               alt="Brasão de São Paulo" 
               className="h-24 w-auto drop-shadow-sm"
             />
          </div>
          <h1 className="text-xl font-bold text-slate-800 text-center leading-tight">Controle de Processos</h1>
          <p className="text-slate-500 text-sm font-medium mt-1">Assessoria CGOF</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <User size={18} />
                </div>
                <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition"
                placeholder="nome@exemplo.com"
                disabled={isSubmitting}
                autoFocus
                />
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Senha</label>
            <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock size={18} />
                </div>
                <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition"
                placeholder="••••••••"
                disabled={isSubmitting}
                />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-red-600 text-xs bg-red-50 p-3 rounded border border-red-100 animate-in slide-in-from-top-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-accent text-white py-2.5 rounded-lg font-medium hover:bg-blue-600 transition shadow-sm flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed mt-2"
          >
            {isSubmitting ? <Loader2 className="animate-spin mr-2" size={20} /> : 'Entrar no Sistema'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-100 text-center text-xs text-slate-400">
          <p>Acesso restrito a usuários autorizados.</p>
        </div>
      </div>
    </div>
  );
};