import Dexie, { Table } from 'dexie';
import { User, Process, Log, UserRole, ProcessCategory } from '../types';

class ProControlDatabase extends Dexie {
  users!: Table<User, string>;
  processes!: Table<Process, string>;
  logs!: Table<Log, string>;

  constructor() {
    super('ProControlDB');
    (this as any).version(1).stores({
      users: 'id, &email, role',
      processes: 'id, category, number, deadline, updatedAt',
      logs: 'id, action, userId, timestamp'
    });
  }
}

export const db = new ProControlDatabase();

// Seed initial data if DB is empty
(db as any).on('populate', () => {
  db.users.add({
    id: 'admin-1',
    name: 'Administrador',
    email: 'admin@sistema.com',
    role: UserRole.ADMIN,
    active: true,
    password: '123'
  });
});

const STORAGE_SESSION_KEY = 'procontrol_session_id';

export const DbService = {
  // --- USERS ---
  getUsers: async (): Promise<User[]> => {
    return await db.users.toArray();
  },

  saveUser: async (user: User, performedBy: User): Promise<void> => {
    const exists = await db.users.get(user.id);
    
    if (exists) {
      // Retain password if empty in update
      const userToSave = { ...user };
      if (!userToSave.password) userToSave.password = exists.password;
      
      await db.users.put(userToSave);
      await DbService.logAction('USER_MGMT', `Usuário atualizado: ${user.name}`, performedBy, user.id);
    } else {
      await db.users.add(user);
      await DbService.logAction('USER_MGMT', `Usuário criado: ${user.name}`, performedBy, user.id);
    }
  },

  deleteUser: async (userId: string, performedBy: User): Promise<void> => {
    await db.users.delete(userId);
    await DbService.logAction('USER_MGMT', `Usuário excluído (ID: ${userId})`, performedBy, userId);
  },

  // --- PROCESSES ---
  getProcesses: async (): Promise<Process[]> => {
    return await db.processes.toArray();
  },

  saveProcess: async (process: Process, performedBy: User): Promise<void> => {
    const exists = await db.processes.get(process.id);
    
    if (exists) {
      const updated = { 
        ...process, 
        updatedBy: performedBy.id, 
        updatedAt: new Date().toISOString() 
      };
      await db.processes.put(updated);
      await DbService.logAction('UPDATE', `Processo atualizado: ${process.number}`, performedBy, process.id);
    } else {
      const created = {
        ...process,
        createdBy: performedBy.id,
        updatedBy: performedBy.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await db.processes.add(created);
      await DbService.logAction('CREATE', `Processo criado: ${process.number}`, performedBy, process.id);
    }
  },

  // Bulk Import for Excel
  importProcesses: async (processes: Process[], performedBy: User): Promise<void> => {
    // Bulk add is faster for imports
    await db.processes.bulkAdd(processes);
    await DbService.logAction('CREATE', `Importação em massa: ${processes.length} processos`, performedBy);
  },

  deleteProcess: async (processId: string, performedBy: User): Promise<void> => {
    const process = await db.processes.get(processId);
    await db.processes.delete(processId);
    await DbService.logAction('DELETE', `Processo excluído: ${process?.number || processId}`, performedBy, processId);
  },

  // --- LOGS ---
  getLogs: async (): Promise<Log[]> => {
    const logs = await db.logs.toArray();
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  logAction: async (action: Log['action'], description: string, user: User, targetId?: string) => {
    await db.logs.add({
      id: crypto.randomUUID(),
      action,
      description,
      userId: user.id,
      userName: user.name,
      timestamp: new Date().toISOString(),
      targetId
    });
  },

  // --- AUTH ---
  login: async (email: string, pass: string): Promise<User | null> => {
    // Check by email first
    let user = await db.users.where('email').equals(email).first();
    
    // Fallback: check by name if email failed (as per original logic allowing login/email)
    if (!user) {
      const allUsers = await db.users.toArray();
      user = allUsers.find(u => u.name === email);
    }

    if (user && user.password === pass && user.active) {
      await DbService.logAction('LOGIN', `Login realizado`, user);
      localStorage.setItem(STORAGE_SESSION_KEY, user.id);
      return user;
    }
    return null;
  },

  logout: async (user: User) => {
     await DbService.logAction('LOGOUT', `Logout realizado`, user);
     localStorage.removeItem(STORAGE_SESSION_KEY);
  },

  getCurrentUser: async (): Promise<User | null> => {
    const id = localStorage.getItem(STORAGE_SESSION_KEY);
    if (!id) return null;
    return (await db.users.get(id)) || null;
  }
};