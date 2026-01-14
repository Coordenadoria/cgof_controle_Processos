
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Process, CGOF_OPTIONS, ProcessQueryParams, UserRole } from '../types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Search, Plus, Edit, Trash2, Download, AlertTriangle, 
  Flag, X, CheckSquare, Square, Filter, ChevronLeft, ChevronRight, Calendar, Activity, ChevronDown, Check, Loader2, Lock, AlertCircle, Upload, FileText,
  MapPinOff, CalendarOff
} from 'lucide-react';
import { DbService } from '../services/dbService';

// =====================
// Utilitários de data
// =====================

export function toServerTimestampNoonLocal(dateInput: string | Date | null | undefined): string | null {
  if (!dateInput) return null;
  let dateStr: string;
  if (dateInput instanceof Date) {
    dateStr = dateInput.toLocaleDateString('fr-CA', { timeZone: 'America/Sao_Paulo' });
  } else {
    dateStr = dateInput.toString().slice(0, 10);
  }
  if (!dateStr || dateStr.length !== 10) return null;
  return `${dateStr}T12:00:00-03:00`;
}

export function toDisplayDate(isoOrDate: string | Date | null | undefined): string {
  if (!isoOrDate) return '-';
  if (typeof isoOrDate === 'string') {
    const datePart = isoOrDate.slice(0, 10);
    if (datePart.includes('-')) {
        const [year, month, day] = datePart.split('-');
        return `${day}/${month}/${year}`;
    }
  }
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export function toServerDateOnly(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';
  if (typeof dateInput === 'string') return dateInput.slice(0, 10);
  const d = dateInput;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-CA', { timeZone: 'America/Sao_Paulo' });
}

const getTodayLocalISO = () => new Date().toLocaleDateString('fr-CA', { timeZone: 'America/Sao_Paulo' });

// --- Internal Component: Combobox ---
interface ComboboxProps {
  label: string;
  name: string;
  options: string[];
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
}

const Combobox = ({ label, name, options, defaultValue = '', required = false, placeholder = '' }: ComboboxProps) => {
  const [inputValue, setInputValue] = useState(defaultValue || '');
  const [filteredOptions, setFilteredOptions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync state with defaultValue when it changes externally
  useEffect(() => { 
    setInputValue(defaultValue || ''); 
  }, [defaultValue]);

  // Update suggestions whenever options or input value changes
  useEffect(() => {
    const lower = inputValue.toLowerCase().trim();
    if (lower) {
      const filtered = options.filter(opt => opt && opt.toLowerCase().includes(lower));
      // Se a filtragem for maior que 0, mostra o que encontrou, caso contrário mostra opções iniciais
      setFilteredOptions(filtered.slice(0, 15));
    } else {
      setFilteredOptions(options.slice(0, 15));
    }
  }, [inputValue, options]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const handleSelectOption = (opt: string) => {
    setInputValue(opt);
    setShowSuggestions(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-sm font-bold text-slate-700 mb-1">{label}</label>
      <div className="relative">
        <input 
          type="text" 
          name={name} 
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
          placeholder={placeholder} required={required} autoComplete="off"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          <ChevronDown size={14} />
        </div>
      </div>
      {showSuggestions && filteredOptions.length > 0 && (
        <ul className="absolute z-[100] w-full bg-white border border-slate-200 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-150 border-t-0">
          {filteredOptions.map((opt, idx) => (
            <li 
              key={`${name}-opt-${idx}`} 
              className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer text-slate-700 flex items-center justify-between border-b border-slate-50 last:border-0"
              onMouseDown={(e) => {
                // Use onMouseDown instead of onClick to prevent focus loss before selection
                e.preventDefault();
                handleSelectOption(opt);
              }}
            >
              {opt}
              {inputValue === opt && <Check size={14} className="text-blue-500"/>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const STORAGE_KEY_FILTERS = 'process_manager_filters';
const getInitialState = <T,>(key: string, defaultValue: T): T => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_FILTERS);
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed[key] !== undefined ? parsed[key] : defaultValue;
    }
  } catch (e) {}
  return defaultValue;
};

export const ProcessManager = () => {
  const { 
    processes, totalProcessesCount, fetchProcesses, fetchProcessHistory, currentUser,
    saveProcess, deleteLastMovement, loading, importProcesses
  } = useApp();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<Process | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  
  const [sectorOptions, setSectorOptions] = useState<string[]>([]);
  const [interestedOptions, setInterestedOptions] = useState<string[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<string[]>([]);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedProcessHistory, setSelectedProcessHistory] = useState<Process[]>([]);
  const [selectedProcessNumber, setSelectedProcessNumber] = useState<string>('');

  const [searchTerm, setSearchTerm] = useState(() => getInitialState('searchTerm', ''));
  const [filterCgof, setFilterCgof] = useState(() => getInitialState('filterCgof', ''));
  const [filterSector, setFilterSector] = useState(() => getInitialState('filterSector', ''));
  const [filterEntryDateStart, setFilterEntryDateStart] = useState(() => getInitialState('filterEntryDateStart', ''));
  const [filterEntryDateEnd, setFilterEntryDateEnd] = useState(() => getInitialState('filterEntryDateEnd', ''));
  const [filterUrgent, setFilterUrgent] = useState(() => getInitialState('filterUrgent', false));
  const [filterOverdue, setFilterOverdue] = useState(() => getInitialState('filterOverdue', false));
  const [filterEmptySector, setFilterEmptySector] = useState(() => getInitialState('filterEmptySector', false));
  const [filterEmptyExitDate, setFilterEmptyExitDate] = useState(() => getInitialState('filterEmptyExitDate', false));
  const [sortBy, setSortBy] = useState<'deadline' | 'updatedAt' | 'number' | 'entryDate'>(() => getInitialState('sortBy', 'entryDate'));
  const [itemsPerPage, setItemsPerPage] = useState(() => getInitialState('itemsPerPage', 20));
  const [currentPage, setCurrentPage] = useState(() => getInitialState('currentPage', 1));

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const stateToSave = {
      searchTerm, filterCgof, filterSector, filterEntryDateStart, filterEntryDateEnd,
      filterUrgent, filterOverdue, filterEmptySector, filterEmptyExitDate, sortBy, itemsPerPage, currentPage
    };
    localStorage.setItem(STORAGE_KEY_FILTERS, JSON.stringify(stateToSave));
  }, [searchTerm, filterCgof, filterSector, filterEntryDateStart, filterEntryDateEnd, filterUrgent, filterOverdue, filterEmptySector, filterEmptyExitDate, sortBy, itemsPerPage, currentPage]);

  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedSearchTerm(searchTerm); }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const getCurrentParams = useCallback(() => ({
    page: currentPage,
    itemsPerPage: itemsPerPage,
    searchTerm: debouncedSearchTerm,
    filters: {
      CGOF: filterCgof || undefined,
      sector: filterSector || undefined,
      entryDateStart: filterEntryDateStart || undefined,
      entryDateEnd: filterEntryDateEnd || undefined,
      urgent: filterUrgent ? true : undefined,
      overdue: filterOverdue ? true : undefined,
      emptySector: filterEmptySector ? true : undefined,
      emptyExitDate: filterEmptyExitDate ? true : undefined
    },
    sortBy: {
      field: sortBy,
      order: (sortBy === 'deadline' || sortBy === 'entryDate') ? 'desc' : 'asc'
    }
  }), [currentPage, itemsPerPage, debouncedSearchTerm, filterCgof, filterSector, filterEntryDateStart, filterEntryDateEnd, filterUrgent, filterOverdue, filterEmptySector, filterEmptyExitDate, sortBy]);

  const refreshCurrentList = useCallback(() => {
    fetchProcesses(getCurrentParams());
  }, [getCurrentParams, fetchProcesses]);

  useEffect(() => { refreshCurrentList(); }, [refreshCurrentList]);

  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<any>>, value: any) => {
      setter(value);
      setCurrentPage(1);
  };

  const uniqueProcesses = useMemo(() => {
    const map = new Map<string, Process>();
    processes.forEach(p => {
        if (!map.has(p.number)) map.set(p.number, p);
        else {
            const existing = map.get(p.number)!;
            if (new Date(p.entryDate) > new Date(existing.entryDate)) map.set(p.number, p);
        }
    });
    return Array.from(map.values());
  }, [processes]);

  const availableCgofs = useMemo(() => {
    const currentOptions = new Set(CGOF_OPTIONS);
    processes.forEach(p => { if(p.CGOF) currentOptions.add(p.CGOF as any) });
    return Array.from(currentOptions).sort();
  }, [processes]);

  const totalPages = Math.ceil(totalProcessesCount / itemsPerPage);

  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5;
    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
    } else {
      let startPage = Math.max(1, currentPage - 2);
      let endPage = Math.min(totalPages, currentPage + 2);
      if (startPage === 1) endPage = Math.min(totalPages, maxPagesToShow);
      if (endPage === totalPages) startPage = Math.max(1, totalPages - maxPagesToShow + 1);
      for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
    }
    return pageNumbers;
  };

  const getDeadlineStatus = (deadlineStr: string | null) => {
    if (!deadlineStr) return { label: '-', color: 'text-slate-400' };
    const today = new Date(); today.setHours(0,0,0,0);
    const deadline = new Date(deadlineStr); deadline.setHours(0,0,0,0);
    const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: 'Vencido', color: 'bg-red-100 text-red-700 border-red-200' };
    if (diffDays <= 5) return { label: 'Próximo', color: 'bg-amber-100 text-amber-700 border-amber-200' };
    return { label: 'No Prazo', color: 'bg-green-100 text-green-700 border-green-200' };
  };

  const handleOpenModal = async (process?: Process) => {
    setLoadingEdit(true);
    setIsModalOpen(true);
    setEditingProcess(process || null);
    
    try {
        const [setoresRpc, interessadasRpc, assuntosRpc] = await Promise.all([
            DbService.getUniqueValues('sector'),
            DbService.getUniqueValues('interested'),
            DbService.getUniqueValues('subject')
        ]);
        
        // Coletar valores locais como fallback caso o RPC falhe ou não esteja configurado
        const localSectors = Array.from(new Set(processes.map(p => p.sector).filter(Boolean))).sort();
        const localInterested = Array.from(new Set(processes.map(p => p.interested).filter(Boolean))).sort();
        const localSubjects = Array.from(new Set(processes.map(p => p.subject).filter(Boolean))).sort();

        setSectorOptions(setoresRpc.length > 0 ? setoresRpc : (localSectors.length > 0 ? localSectors : ['SES-GS-ATG8', 'GS/RECEBIMENTO']));
        setInterestedOptions(interessadasRpc.length > 0 ? interessadasRpc : localInterested);
        setSubjectOptions(assuntosRpc.length > 0 ? assuntosRpc : localSubjects);
    } catch (error) { 
        console.error("Erro ao carregar listas de sugestão:", error); 
    } finally {
        setLoadingEdit(false);
    }
  };

  const handleCloseModal = () => { setIsModalOpen(false); setEditingProcess(null); };

  const handleOpenHistory = async (process: Process) => {
    setSelectedProcessNumber(process.number);
    setIsHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
        const history = await fetchProcessHistory(process.number);
        setSelectedProcessHistory(history);
    } catch (e) { console.error("Failed to load history", e); }
    finally { setHistoryLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRef.current) return;
    setSaving(true);
    const formData = new FormData(formRef.current);
    const entryDate = toServerTimestampNoonLocal(formData.get('entryDate') as string);
    const processDate = toServerTimestampNoonLocal(formData.get('processDate') as string);
    const deadline = toServerTimestampNoonLocal(formData.get('deadline') as string);
    if (!entryDate) { alert("Data de entrada é obrigatória"); setSaving(false); return; }

    const now = new Date().toISOString();
    const newProcess: Process = {
      id: editingProcess?.id || crypto.randomUUID(),
      category: 'Assessoria',
      CGOF: formData.get('cgof') as string,
      entryDate, number: formData.get('number') as string,
      interested: formData.get('interested') as string,
      subject: formData.get('subject') as string,
      sector: formData.get('sector') as string,
      processDate, urgent: formData.get('urgent') === 'on',
      deadline, observations: formData.get('observations') as string,
      createdBy: editingProcess?.createdBy || currentUser?.id || 'system',
      createdAt: editingProcess?.createdAt || now,
      updatedBy: currentUser?.id || 'system',
      updatedAt: now
    };

    try {
        await saveProcess(newProcess);
        alert(editingProcess ? 'Atualizado com sucesso!' : 'Cadastrado com sucesso!');
        handleCloseModal();
        refreshCurrentList();
        
        if (isHistoryModalOpen) {
          const updatedHistory = await fetchProcessHistory(selectedProcessNumber);
          setSelectedProcessHistory(updatedHistory);
        }
    } catch (error: any) { 
        alert('Erro ao salvar: ' + (error?.message || 'Verifique os dados.')); 
    }
    finally { setSaving(false); }
  };

  const handleConfirmPasswordDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsVerifyingPassword(true); setPasswordError('');
    try {
        const isValid = await DbService.verifyPassword(currentUser.id, confirmPassword);
        if (!isValid) { setPasswordError('Senha incorreta.'); setIsVerifyingPassword(false); return; }
        await deleteLastMovement(selectedProcessNumber);
        setIsPasswordModalOpen(false); alert('Excluído com sucesso!');
        const updatedHistory = await fetchProcessHistory(selectedProcessNumber);
        setSelectedProcessHistory(updatedHistory); refreshCurrentList();
        if (updatedHistory.length === 0) setIsHistoryModalOpen(false);
    } catch (err: any) { 
        setPasswordError('Erro ao excluir: ' + (err?.message || 'Tente novamente.')); 
    }
    finally { setIsVerifyingPassword(false); }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        const processesToImport: Process[] = data.map((row: any) => {
          const keys = Object.keys(row);
          const getVal = (possibleNames: string[]) => {
            const foundKey = keys.find(k => possibleNames.some(name => k.toLowerCase().trim() === name.toLowerCase().trim()));
            return foundKey ? row[foundKey] : undefined;
          };

          const entryRaw = getVal(['Entrada', 'Data Entrada', 'Data da Entrada', 'Data de Entrada']);
          const sectorAtualRaw = getVal(['Localização', 'Setor Atual', 'Setor', 'Destino']);
          const sectorEntradaRaw = getVal(['Origem (CGOF)', 'Origem', 'CGOF', 'Setor de Entrada']);
          const num = getVal(['Número', 'Numero', 'Processo']) || 'S/N';
          const saidaRaw = getVal(['saida', 'Saída', 'Data Saída', 'Data de Saída']);
          const retornoRaw = getVal(['Retorno', 'Prazo', 'Data de Retorno', 'Data Limite']);
          
          const now = new Date().toISOString();
          
          const parseExcelDate = (val: any) => {
             if (!val) return null;
             if (typeof val === 'number') {
                 return toServerTimestampNoonLocal(new Date((val - (25567 + 1)) * 86400 * 1000));
             }
             if (typeof val === 'string' && val.includes('/')) {
                 const [d, m, y] = val.split('/');
                 return toServerTimestampNoonLocal(`${y}-${m}-${d}`);
             }
             return toServerTimestampNoonLocal(new Date(val));
          };

          return {
            id: crypto.randomUUID(),
            category: 'Assessoria',
            CGOF: String(sectorEntradaRaw || 'Assessoria').trim(),
            entryDate: parseExcelDate(entryRaw) || now,
            number: String(num).trim(),
            interested: String(getVal(['Interessada', 'Interessado', 'Interessados', 'Parte']) || '').trim(),
            subject: String(getVal(['Assunto', 'Descricao', 'Objeto']) || '').trim(),
            sector: String(sectorAtualRaw || '').trim(),
            processDate: parseExcelDate(saidaRaw),
            deadline: parseExcelDate(retornoRaw),
            urgent: String(getVal(['Urgente', 'Prioridade', 'Urgência']) || '').toLowerCase().startsWith('s'),
            observations: String(getVal(['Observações', 'Obs', 'Anotação']) || '').trim(),
            createdBy: currentUser.id,
            updatedBy: currentUser.id,
            createdAt: now,
            updatedAt: now
          };
        });

        if (processesToImport.length > 0) {
            await importProcesses(processesToImport);
            alert(`${processesToImport.length} registros importados com sucesso!`);
            setIsImportModalOpen(false);
            refreshCurrentList();
        }
      } catch (err: any) {
        console.error(err);
        alert("Erro na importação: " + (err?.message || "Verifique o formato do arquivo."));
      } finally {
        setImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const exportExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(uniqueProcesses.map(p => ({
      'Origem (CGOF)': p.CGOF, 
      'Entrada': toDisplayDate(p.entryDate), 
      'Número': p.number,
      'Interessada': p.interested, 
      'Assunto': p.subject, 
      'Localização': p.sector,
      'saida': toDisplayDate(p.processDate), 
      'Urgente': p.urgent ? 'Sim' : 'Não',
      'Retorno': toDisplayDate(p.deadline), 
      'Status': getDeadlineStatus(p.deadline).label
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Processos");
    XLSX.writeFile(workbook, `Fluxo_Processos_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF(); doc.text(`Fluxo de Processos - Relatório Geral`, 14, 15);
    autoTable(doc, {
      startY: 20,
      head: [['Origem', 'Entrada', 'Número', 'Interessada', 'Localização', 'Saída', 'Retorno']],
      body: uniqueProcesses.map(p => [
        p.CGOF || '-', 
        toDisplayDate(p.entryDate), 
        p.number, 
        p.interested, 
        p.sector, 
        toDisplayDate(p.processDate),
        toDisplayDate(p.deadline)
      ]),
      styles: { fontSize: 6.5 }, 
      columnStyles: { 3: { cellWidth: 35 }, 4: { cellWidth: 25 } } 
    });
    doc.save(`Relatorio_Processos_Fluxo.pdf`);
  };

  const isAdmin = currentUser?.role === UserRole.ADMIN;

  return (
    <div className="space-y-4 relative min-h-[calc(100vh-100px)] flex flex-col">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Fluxo de Processos</h2>
          <p className="text-slate-500 text-sm">Controle de entradas, localizações atuais, saídas e retornos</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full xl:w-auto">
           {isAdmin && (
             <>
               <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded text-sm hover:bg-slate-50 transition shadow-sm font-medium text-slate-700">
                 <Upload size={16} /> Importar Excel
               </button>
               <button onClick={exportExcel} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded text-sm hover:bg-slate-50 transition shadow-sm">
                 <Download size={16} /> Excel
               </button>
               <button onClick={exportPDF} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded text-sm hover:bg-slate-50 transition shadow-sm">
                 <Download size={16} /> PDF
               </button>
             </>
           )}
           <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded hover:bg-blue-600 transition ml-auto sm:ml-0 shadow-sm font-medium">
             <Plus size={18} /> Novo Registro
           </button>
        </div>
      </div>

      <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
        <div className="relative col-span-1 md:col-span-2 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Número, interessada ou assunto..." className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded text-sm outline-none" value={searchTerm} onChange={(e) => handleFilterChange(setSearchTerm, e.target.value)} />
        </div>
        <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <select value={filterCgof} onChange={(e) => handleFilterChange(setFilterCgof, e.target.value)} className="w-full pl-8 pr-8 py-2 border border-slate-300 rounded bg-white text-sm outline-none">
                <option value="">Todas Origens (CGOF)</option>
                {availableCgofs.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
        </div>
         <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input type="text" value={filterSector} onChange={(e) => handleFilterChange(setFilterSector, e.target.value)} placeholder="Filtrar Localização..." className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded text-sm outline-none" />
        </div>
        <div className="relative flex items-center gap-2 bg-white border border-slate-300 rounded px-2 py-1.5">
            <Calendar className="text-slate-400" size={14} />
            <div className="flex-1 flex items-center gap-1">
              <input type="date" value={filterEntryDateStart} onChange={(e) => handleFilterChange(setFilterEntryDateStart, e.target.value)} className="w-full text-[10px] outline-none text-slate-600 bg-transparent" />
              <span className="text-slate-400">-</span>
              <input type="date" value={filterEntryDateEnd} onChange={(e) => handleFilterChange(setFilterEntryDateEnd, e.target.value)} className="w-full text-[10px] outline-none text-slate-600 bg-transparent" />
            </div>
        </div>
        <div className="flex gap-1.5 w-full lg:col-span-1 justify-end">
          <button onClick={() => handleFilterChange(setFilterUrgent, !filterUrgent)} className={`px-2 py-2 rounded border transition-colors ${filterUrgent ? 'bg-red-50 border-red-200 text-red-700 shadow-inner' : 'bg-white border-slate-300 text-slate-600'}`} title="Urgentes"><Flag size={14} /></button>
          <button onClick={() => handleFilterChange(setFilterOverdue, !filterOverdue)} className={`px-2 py-2 rounded border transition-colors ${filterOverdue ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-inner' : 'bg-white border-slate-300 text-slate-600'}`} title="Vencidos"><AlertTriangle size={14} /></button>
          <button onClick={() => handleFilterChange(setFilterEmptySector, !filterEmptySector)} className={`px-2 py-2 rounded border transition-colors ${filterEmptySector ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-inner' : 'bg-white border-slate-300 text-slate-600'}`} title="Sem Localização"><MapPinOff size={14} /></button>
          <button onClick={() => handleFilterChange(setFilterEmptyExitDate, !filterEmptyExitDate)} className={`px-2 py-2 rounded border transition-colors ${filterEmptyExitDate ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-inner' : 'bg-white border-slate-300 text-slate-600'}`} title="Sem Saída"><CalendarOff size={14} /></button>
          <button onClick={() => { setSearchTerm(''); setFilterCgof(''); setFilterSector(''); setFilterEntryDateStart(''); setFilterEntryDateEnd(''); setFilterUrgent(false); setFilterOverdue(false); setFilterEmptySector(false); setFilterEmptyExitDate(false); setCurrentPage(1); }} className="px-2 text-[10px] font-bold text-blue-600 hover:underline uppercase tracking-tighter">Limpar</button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-[400px]">
        <div className="overflow-x-auto flex-1 relative">
            {loading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                </div>
            )}
          <table className="w-full text-sm text-left">
            <thead className="text-[11px] text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0 z-10 font-bold">
              <tr>
                <th className="px-4 py-3 w-10">
                  <button onClick={() => { if (selectedIds.size === uniqueProcesses.length) setSelectedIds(new Set()); else setSelectedIds(new Set(uniqueProcesses.map(p => p.id))); }}>
                    {selectedIds.size > 0 && selectedIds.size === uniqueProcesses.length ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>
                </th>
                <th className="px-2 py-3">Número</th>
                <th className="px-2 py-3">Entrada</th>
                <th className="px-2 py-3">Origem</th>
                <th className="px-3 py-3 min-w-[130px]">Interessada</th>
                <th className="px-3 py-3 min-w-[150px]">Assunto</th>
                <th className="px-2 py-3">Localização</th>
                <th className="px-2 py-3">Saída</th>
                <th className="px-2 py-3">Retorno</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {uniqueProcesses.map(process => {
                const status = getDeadlineStatus(process.deadline);
                return (
                  <tr key={process.id} className={`group hover:bg-blue-50/30 transition-colors ${selectedIds.has(process.id) ? 'bg-blue-50/80' : ''}`}>
                    <td className="px-4 py-2">
                      <button onClick={() => { const s = new Set(selectedIds); if (s.has(process.id)) s.delete(process.id); else s.add(process.id); setSelectedIds(s); }}>
                         {selectedIds.has(process.id) ? <CheckSquare size={16} className="text-blue-500" /> : <Square size={16} />}
                      </button>
                    </td>
                    <td className="px-2 py-2 font-mono text-slate-900 whitespace-nowrap align-top font-bold text-[10.5px]">
                        <button onClick={() => handleOpenHistory(process)} className="hover:underline text-blue-700">{process.number}</button>
                    </td>
                    <td className="px-2 py-2 text-[10.5px] text-slate-600 align-top font-medium whitespace-nowrap">{toDisplayDate(process.entryDate)}</td>
                    <td className="px-2 py-2 text-[10.5px] font-semibold text-slate-700 align-top">{process.CGOF || '-'}</td>
                    <td className="px-3 py-2 text-[10.5px] text-slate-700 align-top leading-tight">{process.interested}</td>
                    <td className="px-3 py-2 text-[10.5px] text-slate-600 align-top leading-tight">{process.subject}</td>
                    <td className="px-2 py-2 text-[10.5px] text-slate-500 align-top">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shadow-sm block w-fit max-w-[100px] truncate" title={process.sector}>{process.sector || <span className="text-slate-300 italic">Vazio</span>}</span>
                    </td>
                    <td className="px-2 py-2 text-[10.5px] text-slate-600 align-top font-medium italic whitespace-nowrap">
                        {process.processDate ? toDisplayDate(process.processDate) : <span className="text-slate-300">Em curso</span>}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap align-top">
                       {process.deadline ? (
                          <div className="flex flex-col items-start">
                            <span className="text-[10.5px] text-slate-700 font-bold">{toDisplayDate(process.deadline)}</span>
                            <span className={`text-[8.5px] uppercase font-bold px-1.5 rounded border mt-0.5 ${status.color}`}>{status.label}</span>
                          </div>
                       ) : <span className="text-slate-300 text-[10.5px]">-</span>}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap align-top">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleOpenHistory(process)} className="p-1 text-slate-600 hover:text-blue-600 rounded" title="Ver Histórico"><Activity size={16} /></button>
                        <button onClick={() => handleOpenModal(process)} className="p-1 text-slate-600 hover:text-blue-600 rounded" title="Editar"><Edit size={16} /></button>
                        <button onClick={() => { setSelectedProcessNumber(process.number); setIsPasswordModalOpen(true); }} className="p-1 text-slate-400 hover:text-red-600 rounded" title="Excluir"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && uniqueProcesses.length === 0 && (
             <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
               <Search size={48} className="mb-3 opacity-10" />
               <p>Nenhum processo encontrado.</p>
             </div>
          )}
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm gap-4 mt-auto">
        <div className="text-xs text-slate-500">Página {currentPage} de {totalPages} ({totalProcessesCount} registros)</div>
        <div className="flex items-center gap-3">
          <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="border border-slate-300 rounded px-2 py-1 text-xs outline-none">
               {[10, 20, 50, 100, 500].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <div className="flex items-center rounded-md border border-slate-300 divide-x divide-slate-300 overflow-hidden">
            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-1.5 hover:bg-slate-50 disabled:opacity-50"><ChevronLeft size={14} /></button>
            <div className="flex">
                {getPageNumbers().map(pageNum => (
                    <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`px-3 py-1.5 text-xs font-medium ${currentPage === pageNum ? 'bg-blue-50 text-blue-600' : 'bg-white hover:bg-slate-50'}`}>{pageNum}</button>
                ))}
            </div>
            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className="p-1.5 hover:bg-slate-50 disabled:opacity-50"><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>

      {isImportModalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-800 p-4 flex justify-between items-center text-white">
               <div className="flex items-center gap-2">
                 <Upload size={20} />
                 <h3 className="font-bold">Importar Fluxo de Excel</h3>
               </div>
               <button onClick={() => setIsImportModalOpen(false)}><X size={20}/></button>
            </div>
            <div className="p-8 space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex gap-3 items-start shadow-sm">
                    <FileText className="text-blue-500 shrink-0 mt-1" size={20} />
                    <div className="text-sm text-blue-800">
                        <p className="font-bold mb-1 text-blue-900">Cabeçalhos Esperados:</p>
                        <ul className="list-disc ml-4 mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                            <li><strong>Origem (CGOF)</strong></li>
                            <li><strong>Entrada</strong></li>
                            <li><strong>Número</strong></li>
                            <li><strong>Interessada</strong></li>
                            <li><strong>Assunto</strong></li>
                            <li><strong>Localização</strong></li>
                            <li><strong>saida</strong></li>
                            <li><strong>Retorno</strong></li>
                        </ul>
                    </div>
                </div>

                <div className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center hover:border-accent transition-all relative group bg-slate-50/50">
                    {importing ? (
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="animate-spin text-accent" size={40} />
                            <p className="text-sm font-medium text-slate-600">Gravando dados e normalizando Enums...</p>
                        </div>
                    ) : (
                        <label className="cursor-pointer flex flex-col items-center gap-3">
                            <Upload className="text-slate-400 group-hover:text-accent transition-colors" size={48} />
                            <span className="text-sm font-medium text-slate-700">Selecione o arquivo .xlsx ou .xls</span>
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Planilha de Fluxo</span>
                            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
                        </label>
                    )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">Cancelar</button>
                </div>
            </div>
          </div>
        </div>
      )}

      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden transform">
                <div className="bg-red-50 p-4 border-b border-red-100 flex items-center gap-3">
                    <Trash2 className="text-red-600" size={24} />
                    <h3 className="font-bold text-red-900">Excluir Movimento</h3>
                    <button onClick={() => setIsPasswordModalOpen(false)} className="ml-auto text-red-400 hover:text-red-700"><X size={20} /></button>
                </div>
                <form onSubmit={handleConfirmPasswordDelete} className="p-6 space-y-4">
                    <p className="text-slate-600 text-sm">Confirme sua senha para excluir a última movimentação de <span className="font-bold">{selectedProcessNumber}</span>:</p>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input ref={passwordInputRef} type="password" value={confirmPassword} onChange={(e) => {setConfirmPassword(e.target.value); setPasswordError('');}} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-200 outline-none" placeholder="Senha de acesso" required />
                    </div>
                    {passwordError && <div className="text-red-600 text-xs flex items-center gap-1 font-medium"><AlertCircle size={12}/>{passwordError}</div>}
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setIsPasswordModalOpen(false)} className="flex-1 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium border border-slate-200">Cancelar</button>
                        <button type="submit" disabled={isVerifyingPassword || !confirmPassword} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium flex justify-center items-center gap-2 hover:bg-red-700 shadow-sm">{isVerifyingPassword ? <Loader2 size={16} className="animate-spin" /> : 'Excluir'}</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Activity size={20} className="text-blue-600"/>Histórico do Fluxo</h3>
                <p className="text-xs font-mono text-slate-600 mt-1">Número: {selectedProcessNumber}</p>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="p-1 hover:bg-slate-200 rounded transition-colors"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                {historyLoading ? (
                    <div className="flex flex-col items-center h-48 justify-center gap-3"><Loader2 size={32} className="animate-spin text-blue-500" /></div>
                ) : (
                    <div className="relative border-l-2 border-blue-100 ml-4 space-y-6">
                        {selectedProcessHistory.map((item, idx) => (
                            <div key={item.id} className="relative pl-8">
                                <div className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 ${idx === selectedProcessHistory.length - 1 ? 'bg-blue-600 border-blue-600' : 'bg-white border-blue-200'}`}></div>
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                                                {idx === selectedProcessHistory.length - 1 ? 'Localização Atual' : 'Movimentação'}
                                            </span>
                                            <h4 className="font-bold text-slate-800 text-sm">{item.sector || 'Não Informado'}</h4>
                                        </div>
                                        <div className="flex items-start gap-4">
                                            <div className="text-right">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Entrada</span>
                                                <div className="text-xs font-bold text-blue-600">{toDisplayDate(item.entryDate)}</div>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <button 
                                                    onClick={() => handleOpenModal(item)} 
                                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                    title="Editar esta movimentação"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-100 text-[11px]">
                                        <div>
                                            <span className="text-slate-400">Origem:</span>
                                            <span className="ml-1 font-medium text-slate-700">{item.CGOF}</span>
                                        </div>
                                        <div className="text-right">
                                            {item.processDate && (
                                                <>
                                                    <span className="text-slate-400">Saída:</span>
                                                    <span className="ml-1 font-medium text-red-600">{toDisplayDate(item.processDate)}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {item.observations && (
                                        <div className="mt-2 pt-2 border-t border-dashed border-slate-100 italic text-[10px] text-slate-500">
                                            Obs: {item.observations}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className="p-4 border-t bg-white flex justify-end">
                <button onClick={() => setIsHistoryModalOpen(false)} className="px-6 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-slate-700">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
            {loadingEdit ? (
                <div className="flex flex-col items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-blue-500"/></div>
            ) : (
             <>
            <div className="flex items-center justify-between p-4 border-b bg-slate-50 sticky top-0 z-20">
              <h3 className="text-lg font-bold text-slate-800">{editingProcess ? 'Editar Registro' : 'Lançar Novo Registro'}</h3>
              <button onClick={handleCloseModal} className="p-1 hover:bg-slate-200 rounded"><X size={24} /></button>
            </div>
            <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                  <label className="block text-sm font-bold mb-1 text-slate-700">Origem (CGOF)</label>
                  <select name="cgof" defaultValue={editingProcess?.CGOF || 'Assessoria'} className="w-full p-2 border border-slate-300 rounded-lg outline-none text-sm focus:ring-2 focus:ring-blue-100">
                    {CGOF_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div>
                   <Combobox 
                    label="Localização Atual" 
                    name="sector" 
                    options={sectorOptions} 
                    defaultValue={editingProcess?.sector} 
                    required 
                    placeholder="Selecione ou digite o setor" 
                   />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1 text-slate-700">Data de Entrada</label>
                  <input required name="entryDate" type="date" defaultValue={toServerDateOnly(editingProcess?.entryDate) || getTodayLocalISO()} className="w-full p-2 border border-slate-300 rounded-lg outline-none text-sm focus:ring-2 focus:ring-blue-100" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1 text-slate-700">Número do Processo</label>
                  <input required name="number" type="text" defaultValue={editingProcess?.number} className="w-full p-2 border border-slate-300 rounded-lg outline-none text-sm font-mono placeholder-slate-300 focus:ring-2 focus:ring-blue-100" placeholder="000.000/0000" />
                </div>
              </div>
              <div className="space-y-4">
                <div><Combobox label="Interessada" name="interested" options={interestedOptions} defaultValue={editingProcess?.interested} required placeholder="Quem solicita ou órgão" /></div>
                <div><Combobox label="Assunto" name="subject" options={subjectOptions} defaultValue={editingProcess?.subject} required placeholder="Objeto do processo" /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold mb-1 text-slate-700">Data de Saída</label>
                    <input name="processDate" type="date" defaultValue={toServerDateOnly(editingProcess?.processDate)} className="w-full p-2 border border-slate-300 rounded-lg outline-none text-sm focus:ring-2 focus:ring-blue-100" />
                </div>
                <div>
                    <label className="block text-sm font-bold mb-1 text-slate-700">Data de Retorno</label>
                    <input name="deadline" type="date" defaultValue={toServerDateOnly(editingProcess?.deadline)} className="w-full p-2 border border-slate-300 rounded-lg outline-none text-sm focus:ring-2 focus:ring-blue-100" />
                </div>
              </div>
               <div className="flex items-center gap-2 bg-red-50 p-2 rounded-lg border border-red-100 w-fit">
                   <input name="urgent" type="checkbox" id="urgent-check" defaultChecked={editingProcess?.urgent} className="w-4 h-4 text-red-600 focus:ring-red-200" />
                   <label htmlFor="urgent-check" className="text-sm font-bold text-red-700 flex items-center gap-1 cursor-pointer"><Flag size={14} fill="currentColor" /> Urgente</label>
                </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-slate-700">Observações</label>
                <textarea name="observations" rows={3} defaultValue={editingProcess?.observations} className="w-full p-2 border border-slate-300 rounded-lg outline-none text-sm focus:ring-2 focus:ring-blue-100" placeholder="Informações adicionais..."></textarea>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 sticky bottom-0 bg-white">
                <button type="button" onClick={handleCloseModal} className="px-6 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-bold transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold flex items-center gap-2 text-sm shadow-md hover:bg-blue-700 transition-colors">{saving && <Loader2 size={16} className="animate-spin" />}Gravar</button>
              </div>
            </form>
            </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
