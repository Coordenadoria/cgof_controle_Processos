
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DbService } from '../services/dbService';
import { User, Lock, Save, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

export const Profile = () => {
  const { currentUser, refreshData } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [name, setName] = useState(currentUser?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // 1. Atualizar nome (se mudou)
      if (name !== currentUser.name) {
        await DbService.saveUser({ ...currentUser, name }, currentUser);
      }

      // 2. Atualizar senha (se preenchido)
      if (currentPassword || newPassword || confirmPassword) {
        if (!currentPassword) throw new Error("A senha atual é obrigatória para realizar a troca.");
        if (newPassword.length < 6) throw new Error("A nova senha deve ter no mínimo 6 caracteres.");
        if (newPassword !== confirmPassword) throw new Error("A confirmação da nova senha não coincide.");
        
        await DbService.updateOwnPassword(currentUser.id, currentPassword, newPassword);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }

      setSuccess('Dados atualizados com sucesso!');
      await refreshData();
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar dados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-slate-800">Meu Perfil</h2>
        <p className="text-slate-500 text-sm">Gerencie suas informações de acesso e senha.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-3">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-full">
            <User size={20} />
          </div>
          <h3 className="font-bold text-slate-800 uppercase tracking-tight text-sm">Informações de Conta</h3>
        </div>

        <form onSubmit={handleUpdateProfile} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="block text-sm font-bold text-slate-700">Nome Completo</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                placeholder="Seu nome"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-bold text-slate-700">Email (Login)</label>
              <input 
                type="text" 
                value={currentUser?.email}
                className="w-full p-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-lg outline-none cursor-not-allowed"
                disabled
              />
              <p className="text-[10px] text-slate-400 mt-1">O email de login não pode ser alterado.</p>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-4 text-slate-800">
              <Lock size={18} className="text-slate-400" />
              <h4 className="font-bold text-sm uppercase tracking-wider">Alterar Senha de Acesso</h4>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <label className="block text-sm font-bold text-slate-700">Senha Atual</label>
                <input 
                  type="password" 
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none"
                  placeholder="••••••••"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-sm font-bold text-slate-700">Nova Senha</label>
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-bold text-slate-700">Confirmar Nova Senha</label>
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none"
                    placeholder="Repita a nova senha"
                  />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100 animate-in fade-in slide-in-from-top-1">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-100 animate-in fade-in slide-in-from-top-1">
              <CheckCircle size={18} className="shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button 
              type="submit" 
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold flex items-center gap-2 shadow-md hover:bg-blue-700 transition-all disabled:opacity-70"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
