
export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

// Removed enum ProcessCategory to allow dynamic categories/origins from DB
export type ProcessCategory = string;

// Define specific options for CGOF column
export const CGOF_OPTIONS = [
  'Assessoria',
  'Recebimento',
  'Gabinete do Coordenador'
] as const;

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  password_hash?: string; // Stored hash
  password?: string; // Input only, not stored in DB directly
}

export interface Process {
  id: string;
  category: string; // Changed to string to act as "Origem"
  CGOF: string; // Field for CGOF column (Uppercase as requested)
  entryDate: string; // ISO Date (YYYY-MM-DD)
  number: string;
  interested: string;
  subject: string;
  sector: string;
  processDate: string | null; // ISO Date or null
  urgent: boolean;
  deadline: string | null; // ISO Date or null
  observations?: string;
  
  createdBy: string; // User ID
  updatedBy: string;
  createdAt: string; // ISO Timestamp
  updatedAt: string; // ISO Timestamp
}

export interface Log {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'USER_MGMT';
  description: string;
  userId: string;
  userName: string;
  timestamp: string;
  targetId?: string; // ID of the process or user affected
}

export interface DashboardStats {
  total: number;
  urgent: number;
  overdue: number;
  nearDeadline: number;
  bySector: { name: string; value: number }[];
}

export interface ProcessFilters {
  CGOF?: string;
  sector?: string;
  entryDateStart?: string;
  entryDateEnd?: string;
  urgent?: boolean;
  overdue?: boolean;
  emptySector?: boolean;
  emptyExitDate?: boolean;
}

export interface ProcessSort {
  field: 'deadline' | 'updatedAt' | 'number' | 'entryDate';
  order: 'asc' | 'desc';
}

export interface ProcessQueryParams {
  page: number;
  itemsPerPage: number;
  searchTerm?: string;
  filters?: ProcessFilters;
  sortBy?: ProcessSort;
}
