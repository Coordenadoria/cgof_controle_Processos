
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { DbService } from '../services/dbService';
import { User, UserRole } from '../types';
import { Plus, Trash2, Edit, Shield, Check, X as XIcon, Lock, AlertCircle, Loader2 } from 'lucide-react';

export const UserManagement = () => {
  const { saveUser, deleteUser, currentUser } = useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form State
  const [pass, setPass] = useState('');

  // Since users aren't in global context state (only auth user), we fetch them
  const refreshUsers = async () => {
    setLoading(true);
    const data = await DbService.getUsers();
    setUsers(data);
    setLoading(false);
  };

  useEffect(() => {
    refreshUsers();
  }, [isModalOpen]); // Refresh when modal closes

  const handleOpenModal = (user: User | null) => {
      setEditingUser(user);
      setPass('');
      setErrorMsg('');
      setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');
    setSaving(true);
    
    const formData = new FormData(e.currentTarget);
    const role = formData.get('isAdmin') === 'on' ? UserRole.ADMIN : UserRole.USER;
    const passwordInput = formData.get('password') as string;

    // Validation
    if (!editingUser && (!passwordInput || passwordInput.length < 6)) {
        setErrorMsg('Para novos usuários, a senha é obrigatória e deve ter no mínimo 6 caracteres.');
        setSaving(false);
        return;
    }

    if (passwordInput && passwordInput.length > 0 && passwordInput.length < 6) {
        setErrorMsg('A senha deve ter no mínimo 6 caracteres.');
        setSaving(false);
        return;
    }
    
    const userData: User = {
      id: editingUser?.id || crypto.randomUUID(),
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      role: role,
      active: formData.get('active') === 'on',
      // If password field is empty, do not send it (service will ignore update)
      password: passwordInput || undefined
    };

    try {
        await saveUser(userData);
        alert(`Usuário ${editingUser ? 'atualizado' : 'cadastrado'} com sucesso!`);
        setIsModalOpen(false);
        setEditingUser(null);
        await refreshUsers();
    } catch (err: any) {
        setErrorMsg(err.message || "Erro ao salvar usuário.");
    } finally {
        setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (id === currentUser?.id) return alert("Você não pode excluir a si mesmo.");
    if (confirm("Tem certeza que deseja excluir este usuário?")) {
      try {
        await deleteUser(id);
        await refreshUsers();
      } catch (err: any) {
          alert(err.message);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Gerenciamento de Usuários</h2>
        <button 
          onClick={() => handleOpenModal(null)}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded hover:bg-blue-600 shadow-sm"
        >
          <Plus size={18} /> Novo Usuário
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
           <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-3">
               <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
               <p>Carregando usuários...</p>
           </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50">
              <tr>
                <th className="px-6 py-3">Nome</th>
                <th className="px-6 py-3">Login / Email</th>
                <th className="px-6 py-3">Nível</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium">{u.name}</td>
                  <td className="px-6 py-3">{u.email}</td>
                  <td className="px-6 py-3">
                    <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded w-fit ${u.role === UserRole.ADMIN ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                      {u.role === UserRole.ADMIN ? <Shield size={12}/> : null}
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    {u.active ? (
                      <span className="text-green-600 flex items-center gap-1 text-xs bg-green-50 px-2 py-0.5 rounded-full w-fit"><Check size={12}/> Ativo</span>
                    ) : (
                      <span className="text-red-500 flex items-center gap-1 text-xs bg-red-50 px-2 py-0.5 rounded-full w-fit"><XIcon size={12}/> Inativo</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleOpenModal(u)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Editar"><Edit size={16}/></button>
                      {u.id !== currentUser?.id && (
                        <button onClick={() => handleDelete(u.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Excluir"><Trash2 size={16}/></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800">{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h3>
              <button onClick={() => setIsModalOpen(false)}><XIcon size={20} className="text-slate-400 hover:text-slate-600"/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">Nome Completo</label>
                <input required name="name" defaultValue={editingUser?.name} className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none" placeholder="Ex: João Silva"/>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">Email de Login</label>
                <input required type="email" name="email" defaultValue={editingUser?.email} className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none" placeholder="email@empresa.com"/>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <label className="block text-sm font-medium mb-1 text-slate-700 flex items-center gap-1">
                    <Lock size={14} className="text-slate-400"/>
                    {editingUser ? 'Alterar Senha' : 'Definir Senha'}
                </label>
                <input 
                    name="password" 
                    type="password" 
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none" 
                    placeholder={editingUser ? 'Deixe em branco para manter a atual' : 'Mínimo 6 caracteres'} 
                />
                {pass.length > 0 && pass.length < 6 && (
                    <p className="text-xs text-red-500 mt-1">A senha é muito curta (mínimo 6).</p>
                )}
                {editingUser && (
                    <p className="text-[10px] text-slate-500 mt-1">Preencha apenas se desejar redefinir a senha do usuário.</p>
                )}
              </div>

              {errorMsg && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-100">
                      <AlertCircle size={16} className="shrink-0"/>
                      {errorMsg}
                  </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                  <div className="relative flex items-center">
                      <input type="checkbox" name="isAdmin" defaultChecked={editingUser?.role === UserRole.ADMIN} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"/>
                  </div>
                  <span className="flex items-center gap-1"><Shield size={14} className="text-purple-500"/> Administrador</span>
                </label>
                
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                  <input type="checkbox" name="active" defaultChecked={editingUser ? editingUser.active : true} className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"/>
                  <span>Ativo</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2 text-slate-600 hover:bg-slate-100 rounded font-medium">Cancelar</button>
                  <button type="submit" disabled={saving} className="flex-1 py-2 bg-accent text-white rounded font-medium hover:bg-blue-600 flex items-center justify-center gap-2 disabled:opacity-70">
                      {saving && <Loader2 size={16} className="animate-spin"/>}
                      Salvar
                  </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
