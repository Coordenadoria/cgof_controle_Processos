import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, Process, Log, ProcessQueryParams } from '../types';
// Change import to point to the new Supabase service instead of mockDb
import { DbService } from '../services/dbService'; 

interface AppContextType {
  currentUser: User | null;
  processes: Process[];
  totalProcessesCount: number;
  logs: Log[];
  loading: boolean;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  refreshData: () => Promise<void>;
  fetchProcesses: (params: ProcessQueryParams) => Promise<void>;
  fetchProcessHistory: (number: string) => Promise<Process[]>;
  saveProcess: (p: Process) => Promise<void>;
  importProcesses: (p: Process[]) => Promise<void>;
  deleteProcess: (id: string) => Promise<void>;
  deleteLastMovement: (number: string) => Promise<void>;
  saveUser: (u: User) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  updateProcesses: (ids: string[], updates: Partial<Process>) => Promise<void>;
  deleteProcesses: (ids: string[]) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children?: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [totalProcessesCount, setTotalProcessesCount] = useState<number>(0);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  // Initialize
  useEffect(() => {
    const init = async () => {
      try {
        const user = await DbService.getCurrentUser();
        if (user) {
          setCurrentUser(user);
          await loadData();
        }
      } catch (error) {
        console.error("Initialization error:", error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const loadData = async () => {
    // Initial load with default pagination
    const { data, count } = await DbService.getProcesses({ page: 1, itemsPerPage: 20 });
    const l = await DbService.getLogs();
    setProcesses(data);
    setTotalProcessesCount(count);
    setLogs(l);
  };

  const refreshData = async () => {
    await loadData();
  };

  const fetchProcesses = useCallback(async (params: ProcessQueryParams) => {
    setLoading(true);
    try {
      const { data, count } = await DbService.getProcesses(params);
      setProcesses(data);
      setTotalProcessesCount(count);
    } catch (error) {
      console.error("Error fetching processes:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProcessHistory = async (number: string): Promise<Process[]> => {
    return await DbService.getProcessHistory(number);
  };

  const login = async (email: string, pass: string) => {
    const user = await DbService.login(email, pass);
    if (user) {
      setCurrentUser(user);
      await loadData();
      return true;
    }
    return false;
  };

  const logout = async () => {
    if (currentUser) await DbService.logout(currentUser);
    setCurrentUser(null);
    setProcesses([]);
    setLogs([]);
  };

  const saveProcess = async (p: Process) => {
    if (!currentUser) return;
    await DbService.saveProcess(p, currentUser);
    // Don't full refresh, let the component handle re-fetch or optimistically update if needed
    // But for simplicity in this architecture we might want to refresh current view?
    // The component calls fetchProcesses after save usually.
  };

  const updateProcesses = async (ids: string[], updates: Partial<Process>) => {
    if (!currentUser) return;
    await DbService.updateProcesses(ids, updates, currentUser);
  };

  const importProcesses = async (p: Process[]) => {
    if (!currentUser) return;
    await DbService.importProcesses(p, currentUser);
    await refreshData();
  };

  const deleteProcess = async (id: string) => {
    if (!currentUser) return;
    await DbService.deleteProcess(id, currentUser);
  };

  const deleteLastMovement = async (number: string) => {
    if (!currentUser) return;
    await DbService.deleteLastMovement(number, currentUser);
  }

  const deleteProcesses = async (ids: string[]) => {
    if (!currentUser) return;
    await DbService.deleteProcesses(ids, currentUser);
  };

  const saveUser = async (u: User) => {
    if (!currentUser) return;
    await DbService.saveUser(u, currentUser);
    // Users are not in global state, so just db update
  };

  const deleteUser = async (id: string) => {
    if (!currentUser) return;
    await DbService.deleteUser(id, currentUser);
  };

  if (loading && !currentUser && !processes.length) return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium">Conectando ao Supabase...</p>
      </div>
    </div>
  );

  return (
    <AppContext.Provider value={{ 
      currentUser, processes, totalProcessesCount, logs, loading,
      login, logout, refreshData, fetchProcesses, fetchProcessHistory,
      saveProcess, importProcesses, deleteProcess, deleteLastMovement, saveUser, deleteUser,
      updateProcesses, deleteProcesses
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};