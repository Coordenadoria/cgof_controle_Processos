import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Database } from 'lucide-react';

export const Logs = () => {
  const { logs } = useApp();
  const [storageInfo, setStorageInfo] = useState<{usage: number, quota: number} | null>(null);

  useEffect(() => {
    // Check storage usage
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(estimate => {
        setStorageInfo({
          usage: estimate.usage || 0,
          quota: estimate.quota || 0
        });
      });
    }
  }, [logs]); // Re-check when logs change (implies db activity)

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'text-green-600 bg-green-50';
      case 'UPDATE': return 'text-blue-600 bg-blue-50';
      case 'DELETE': return 'text-red-600 bg-red-50';
      case 'LOGIN': return 'text-purple-600 bg-purple-50';
      case 'USER_MGMT': return 'text-amber-600 bg-amber-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Auditoria do Sistema</h2>
        
        {/* Storage Widget */}
        {storageInfo && (
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center gap-4 text-sm min-w-[250px]">
            <div className="p-2 bg-slate-100 rounded-full text-slate-600">
              <Database size={20} />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <p className="text-slate-500 font-medium text-xs uppercase">Banco de Dados</p>
                <span className="text-xs font-bold text-slate-700">{formatBytes(storageInfo.usage)}</span>
              </div>
              
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.max((storageInfo.usage / storageInfo.quota) * 100, 1)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 text-right">
                Capacidade estimada: {formatBytes(storageInfo.quota)}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3">Data / Hora</th>
              <th className="px-6 py-3">Usuário</th>
              <th className="px-6 py-3">Ação</th>
              <th className="px-6 py-3">Descrição</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-slate-50">
                <td className="px-6 py-3 text-slate-500 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString('pt-BR')}
                </td>
                <td className="px-6 py-3 font-medium text-slate-700">
                  {log.userName}
                </td>
                <td className="px-6 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getActionColor(log.action)}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-6 py-3 text-slate-600">
                  {log.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <p className="p-4 text-center text-slate-400">Nenhum registro encontrado.</p>}
      </div>
    </div>
  );
};