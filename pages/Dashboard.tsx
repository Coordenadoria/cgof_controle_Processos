
import React, { useMemo, useEffect, useState } from 'react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
    PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { AlertCircle, FileText, RefreshCw, TrendingUp, MapPin, Database, Search, PieChart as PieIcon, BarChart2, Layers } from 'lucide-react';
import { DbService } from '../services/dbService';
import { Process } from '../types';

export const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Process[]>([]);
  const [realTotalMovements, setRealTotalMovements] = useState(0);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
        const { data: allProcesses, count } = await DbService.getAllProcessesForDashboard();
        setData(allProcesses);
        setRealTotalMovements(count);
    } catch (error) {
        console.error("Falha ao carregar dados do dashboard", error);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Obtém o estado ATUAL de cada processo (última movimentação de cada número único)
  const uniqueProcesses = useMemo(() => {
    const map = new Map<string, Process>();
    
    data.forEach(p => {
        const key = p.number.trim(); 
        if (!map.has(key)) {
            map.set(key, p);
        } else {
            const existing = map.get(key)!;
            const newDate = new Date(p.entryDate).getTime();
            const existingDate = new Date(existing.entryDate).getTime();

            if (newDate > existingDate) {
                map.set(key, p);
            } else if (newDate === existingDate) {
                const newUpdate = new Date(p.updatedAt || p.createdAt || p.entryDate).getTime();
                const existingUpdate = new Date(existing.updatedAt || existing.createdAt || existing.entryDate).getTime();
                if (newUpdate > existingUpdate) {
                    map.set(key, p);
                }
            }
        }
    });
    return Array.from(map.values());
  }, [data]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const fiveDaysFromNow = new Date(today);
    fiveDaysFromNow.setDate(today.getDate() + 5);

    let urgent = 0;
    let overdue = 0;
    let nearDeadline = 0;
    let onTime = 0;
    
    const sectorCount: Record<string, number> = {};
    const originCount: Record<string, number> = {};
    const monthCount: Record<string, number> = {};
    const interestedCount: Record<string, number> = {};

    uniqueProcesses.forEach(p => {
      // 1. Prazos e Urgência
      if (p.urgent) urgent++;
      
      if (p.deadline) {
        const deadline = new Date(p.deadline + 'T00:00:00');
        if (deadline < today) overdue++;
        else if (deadline <= fiveDaysFromNow) nearDeadline++;
        else onTime++;
      } else {
         onTime++;
      }

      // 2. Localização (Setor Atual)
      const sec = p.sector?.trim() || 'Não Informado';
      sectorCount[sec] = (sectorCount[sec] || 0) + 1;

      // 3. Origem (CGOF)
      const origin = p.CGOF || 'Assessoria';
      originCount[origin] = (originCount[origin] || 0) + 1;

      // 4. Interessadas
      const interested = p.interested?.trim() || 'Não Informado';
      interestedCount[interested] = (interestedCount[interested] || 0) + 1;

      // 5. Tendência (por data de entrada)
      if (p.entryDate) {
          const datePart = p.entryDate.toString().slice(0, 10);
          if (datePart.includes('-')) {
             const [y, m] = datePart.split('-');
             const key = `${y}-${m}`;
             monthCount[key] = (monthCount[key] || 0) + 1;
          }
      }
    });

    const sectorData = Object.keys(sectorCount)
        .map(key => ({ name: key, value: sectorCount[key] }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

    const originData = Object.keys(originCount)
        .map(key => ({ name: key, value: originCount[key] }))
        .sort((a, b) => b.value - a.value);

    const interestedData = Object.keys(interestedCount)
        .map(key => ({ name: key.length > 20 ? key.substring(0, 17) + '...' : key, value: interestedCount[key] }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    const trendData = Object.keys(monthCount)
        .sort()
        .map(key => {
            const [year, month] = key.split('-');
            return { name: `${month}/${year}`, value: monthCount[key] };
        })
        .slice(-12);

    const deadlineData = [
        { name: 'No Prazo', value: onTime },
        { name: 'Próximo', value: nearDeadline },
        { name: 'Vencido', value: overdue }
    ].filter(d => d.value > 0);

    return { 
        totalUnique: uniqueProcesses.length, 
        totalHistory: realTotalMovements,
        urgent, 
        overdue, 
        nearDeadline, 
        sectorData, 
        originData,
        interestedData,
        trendData, 
        deadlineData
    };
  }, [uniqueProcesses, realTotalMovements]);

  const COLORS_STATUS = ['#10b981', '#f59e0b', '#ef4444'];
  const COLORS_CHART = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'];

  const StatCard = ({ title, value, icon: Icon, color, bg }: any) => (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100 flex items-start justify-between hover:shadow-md transition-shadow">
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
        <h3 className="text-3xl font-black text-slate-800">{value}</h3>
      </div>
      <div className={`p-3 rounded-lg ${bg} ${color}`}>
        <Icon size={24} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">Painel Gerencial</h2>
            <p className="text-slate-500 text-sm">Resumo executivo de fluxo e monitoramento de processos.</p>
        </div>
        <button 
            onClick={fetchDashboardData} 
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:text-blue-600 transition shadow-sm"
        >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Atualizar
        </button>
      </div>

      {loading && data.length === 0 ? (
         <div className="flex flex-col items-center justify-center h-64">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 mt-4">Calculando indicadores...</p>
         </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
              title="Processos Ativos" 
              value={stats.totalUnique} 
              icon={FileText} 
              color="text-blue-600" 
              bg="bg-blue-50" 
            />
            <StatCard 
              title="Movimentações" 
              value={stats.totalHistory} 
              icon={Database} 
              color="text-slate-600" 
              bg="bg-slate-100" 
            />
            <StatCard 
              title="Casos Urgentes" 
              value={stats.urgent} 
              icon={AlertCircle} 
              color="text-red-600" 
              bg="bg-red-50" 
            />
             <StatCard 
              title="Casos Vencidos" 
              value={stats.overdue} 
              icon={AlertCircle} 
              color="text-amber-600" 
              bg="bg-amber-50" 
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* GRÁFICO DE ORIGEM */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col">
              <div className="flex items-center gap-2 mb-6">
                <PieIcon size={20} className="text-indigo-500"/>
                <h3 className="text-lg font-bold text-slate-800">Processos por Origem</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.originData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {stats.originData.map((entry, index) => (
                        <Cell key={`cell-origin-${index}`} fill={COLORS_CHART[index % COLORS_CHART.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend verticalAlign="bottom" align="center" layout="horizontal" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* STATUS DE PRAZOS */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col">
              <div className="flex items-center gap-2 mb-6">
                <Layers size={20} className="text-emerald-500"/>
                <h3 className="text-lg font-bold text-slate-800">Cumprimento de Prazos</h3>
              </div>
              <div className="h-64">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={stats.deadlineData}
                            cx="50%"
                            cy="50%"
                            innerRadius={0}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="value"
                            label={({name, value}) => `${name}: ${value}`}
                        >
                            {stats.deadlineData.map((entry, index) => (
                                <Cell key={`cell-status-${index}`} fill={COLORS_STATUS[index % COLORS_STATUS.length]} />
                            ))}
                        </Pie>
                        <RechartsTooltip />
                        <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                 </ResponsiveContainer>
              </div>
            </div>

            {/* TENDÊNCIA DE REGISTROS */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col lg:col-span-1">
               <div className="flex items-center gap-2 mb-6">
                  <TrendingUp size={20} className="text-blue-500"/>
                  <h3 className="text-lg font-bold text-slate-800">Histórico de Entradas</h3>
               </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTrendDash" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" tick={{fontSize: 10}} />
                    <YAxis tick={{fontSize: 10}} />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <RechartsTooltip />
                    <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTrendDash)" name="Processos" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             {/* DISTRIBUIÇÃO POR SETOR */}
             <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-6">
                  <MapPin size={20} className="text-indigo-500"/>
                  <h3 className="text-lg font-bold text-slate-800">Ocupação por Setor (Top 8)</h3>
                </div>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            layout="vertical"
                            data={stats.sectorData}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                            <XAxis type="number" tick={{fontSize: 10}} />
                            <YAxis type="category" dataKey="name" width={100} tick={{fontSize: 10}} />
                            <RechartsTooltip cursor={{fill: '#f8fafc'}} />
                            <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} name="Processos" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
             </div>

             {/* TOP INTERESSADAS */}
             <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-6">
                  <BarChart2 size={20} className="text-blue-500"/>
                  <h3 className="text-lg font-bold text-slate-800">Maiores Demandantes (Top 5)</h3>
                </div>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={stats.interestedData}
                            margin={{ top: 20, right: 30, left: 0, bottom: 40 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                              dataKey="name" 
                              angle={-25} 
                              textAnchor="end" 
                              interval={0} 
                              tick={{fontSize: 10}}
                            />
                            <YAxis tick={{fontSize: 10}} />
                            <RechartsTooltip cursor={{fill: '#f8fafc'}} />
                            <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} name="Processos" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
             </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-800 uppercase tracking-tight">Movimentações Atuais</h3>
                  <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Em Trâmite</span>
                  </div>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="text-[10px] text-slate-500 uppercase bg-slate-50 font-black">
                  <tr>
                      <th className="px-4 py-3">Número do Processo</th>
                      <th className="px-4 py-3">Origem (CGOF)</th>
                      <th className="px-4 py-3">Setor Atual</th>
                      <th className="px-4 py-3">Interessada</th>
                      <th className="px-4 py-3">Entrada</th>
                  </tr>
                  </thead>
                  <tbody>
                  {uniqueProcesses
                      .slice(0, 6)
                      .map(process => (
                      <tr key={`recent-${process.id}`} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-blue-700 text-[11px]">{process.number}</td>
                          <td className="px-4 py-3 text-[10px] font-bold text-slate-600 uppercase">{process.CGOF}</td>
                          <td className="px-4 py-3">
                              <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[9px] font-bold uppercase border border-slate-200">
                                  {process.sector || 'Não Informado'}
                              </span>
                          </td>
                          <td className="px-4 py-3 text-[10px] text-slate-500 max-w-[200px] truncate">{process.interested}</td>
                          <td className="px-4 py-3 text-[10px] text-slate-400 font-medium">
                              {new Date(process.entryDate).toLocaleDateString('pt-BR')}
                          </td>
                      </tr>
                  ))}
                  </tbody>
              </table>
              </div>
          </div>
        </>
      )}
    </div>
  );
};
