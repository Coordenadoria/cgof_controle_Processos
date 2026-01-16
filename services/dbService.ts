
/*
================================================================================
INSTRUÇÕES PARA O SQL EDITOR DO SUPABASE:
Execute o código abaixo no seu painel Supabase para criar as funções de busca:

-- 1. Função para Setores Únicos (Localização)
CREATE OR REPLACE FUNCTION public.distinct_setor()
RETURNS TABLE(value text) AS $$
BEGIN
  RETURN QUERY SELECT DISTINCT sector::text AS value
  FROM processes
  WHERE sector IS NOT NULL AND sector <> ''
  ORDER BY value;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Função para Interessadas Únicas
CREATE OR REPLACE FUNCTION public.distinct_interessada()
RETURNS TABLE(value text) AS $$
BEGIN
  RETURN QUERY SELECT DISTINCT interested::text AS value
  FROM processes
  WHERE interested IS NOT NULL AND interested <> ''
  ORDER BY value;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Função para Assuntos Únicos
CREATE OR REPLACE FUNCTION public.distinct_assunto()
RETURNS TABLE(value text) AS $$
BEGIN
  RETURN QUERY SELECT DISTINCT subject::text AS value
  FROM processes
  WHERE subject IS NOT NULL AND subject <> ''
  ORDER BY value;
END;
$$ LANGUAGE plpgsql STABLE;

-- Permissões de Acesso
GRANT EXECUTE ON FUNCTION public.distinct_setor() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.distinct_interessada() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.distinct_assunto() TO anon, authenticated, service_role;
================================================================================
*/

import { supabase } from './supabaseClient';
import { User, Process, Log, UserRole, ProcessQueryParams, CGOF_OPTIONS } from '../types';
import { getInitialAssessoriaData } from './assessoriaData';

// Função para normalizar valores de CGOF e evitar erros de Enum no Supabase
const normalizeCGOF = (value: string): string => {
  const lower = String(value || '').toLowerCase().trim();
  if (lower.includes('recebimento')) return 'Recebimento';
  if (lower.includes('gabinete')) return 'Gabinete do Coordenador';
  return 'Assessoria';
};

// Função auxiliar para garantir que datas vazias sejam enviadas como NULL
const cleanDate = (date: string | null | undefined): string | null => {
  if (!date || date.trim() === '') return null;
  return date;
};

export const DbService = {
  // --- USERS ---
  getUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*').order('name');
    if (error) {
      console.error('Error fetching users:', error.message);
      return [];
    }
    return data as User[];
  },

  saveUser: async (user: User, performedBy: User): Promise<void> => {
    const { data: existingEmail } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .maybeSingle();

    if (existingEmail && existingEmail.id !== user.id) {
      throw new Error('Este email já está cadastrado no sistema.');
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();
    
    const isNewUser = !existingUser;

    const payload: any = {
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active
    };

    if (user.password && user.password.trim().length > 0) {
      payload.password = user.password; 
    } else if (isNewUser) {
      throw new Error("Uma senha é obrigatória para novos usuários.");
    }

    if (isNewUser) {
        const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
        if (count === 0) {
            payload.role = UserRole.ADMIN;
        }
        if (user.id) payload.id = user.id;
    }

    let error;
    if (isNewUser) {
       const { error: insertError } = await supabase.from('users').insert(payload);
       error = insertError;
    } else {
       const { error: updateError } = await supabase.from('users').update(payload).eq('id', user.id);
       error = updateError;
    }

    if (error) {
        throw new Error(error.message || "Erro ao salvar usuário no banco de dados.");
    }

    await DbService.logAction('USER_MGMT', `Usuário ${isNewUser ? 'criado' : 'atualizado'}: ${user.name}`, performedBy, user.id);
  },

  updateOwnPassword: async (userId: string, currentPass: string, newPass: string): Promise<void> => {
    const isValid = await DbService.verifyPassword(userId, currentPass);
    if (!isValid) {
      throw new Error("Senha atual incorreta.");
    }

    const { error } = await supabase
      .from('users')
      .update({ password: newPass })
      .eq('id', userId);

    if (error) throw error;

    const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
    if (user) {
      await DbService.logAction('UPDATE', `Senha alterada pelo próprio usuário`, user as User, userId);
    }
  },

  deleteUser: async (userId: string, performedBy: User): Promise<void> => {
    if (userId === performedBy.id) {
        throw new Error("Você não pode excluir seu próprio usuário.");
    }
    
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) throw error;
    
    await DbService.logAction('USER_MGMT', `Usuário excluído (ID: ${userId})`, performedBy, userId);
  },

  verifyPassword: async (userId: string, password: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data || !data.active) return false;

    // @ts-ignore
    const stored = data.password || data.password_hash;
    return stored === password;
  },

  // --- LOGIN ---
  login: async (email: string, pass: string): Promise<User | null> => {
    const { data: userRaw, error } = await supabase
      .from('users')
      .select('*')
      .ilike('email', email)
      .maybeSingle();

    if (error) {
        console.error("[LOGIN] Erro ao buscar usuário no Supabase:", error.message || error);
        return null;
    }

    if (!userRaw) {
        const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
        if (count === 0) {
            const adminId = crypto.randomUUID();
            await supabase.from('users').insert({
                id: adminId,
                name: 'Administrador',
                email: 'admin@sistema.com',
                password: '123456', 
                role: UserRole.ADMIN,
                active: true
            });
            return DbService.login('admin@sistema.com', '123456');
        }
        return null;
    }

    if (!userRaw.active) return null;

    // @ts-ignore
    const storedPassword = userRaw.password || userRaw.password_hash;

    if (storedPassword === pass) {
        const authenticatedUser = { ...userRaw, role: userRaw.role as UserRole };
        await DbService.logAction('LOGIN', `Login realizado`, authenticatedUser);
        localStorage.setItem('procontrol_session_id', userRaw.id);
        await DbService.checkAndSeedData(authenticatedUser);
        return authenticatedUser;
    }
    return null;
  },

  logout: async (user: User) => {
     await DbService.logAction('LOGOUT', `Logout realizado`, user);
     localStorage.removeItem('procontrol_session_id');
  },

  getCurrentUser: async (): Promise<User | null> => {
    const id = localStorage.getItem('procontrol_session_id');
    if (!id) return null;
    const { data } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
    return data as User | null;
  },

  // --- PROCESSES ---
  getProcesses: async (params?: ProcessQueryParams): Promise<{ data: Process[], count: number }> => {
    let query = supabase.from('processes').select('*', { count: 'exact' });

    if (params) {
      if (params.searchTerm) {
        const term = `%${params.searchTerm}%`;
        query = query.or(`number.ilike.${term},interested.ilike.${term},subject.ilike.${term}`);
      }
      if (params.filters?.CGOF) query = query.eq('CGOF', params.filters.CGOF);
      if (params.filters?.sector) query = query.ilike('sector', `%${params.filters.sector}%`);
      if (params.filters?.entryDateStart) query = query.gte('entryDate', params.filters.entryDateStart);
      if (params.filters?.entryDateEnd) query = query.lte('entryDate', params.filters.entryDateEnd);
      if (params.filters?.urgent) query = query.eq('urgent', true);
      if (params.filters?.overdue) {
        const today = new Date().toISOString().split('T')[0];
        query = query.lt('deadline', today);
      }
      if (params.filters?.emptySector) {
        query = query.or('sector.is.null,sector.eq.""');
      }
      if (params.filters?.emptyExitDate) {
        // Garantindo que buscamos apenas NULL para evitar erro de sintaxe em colunas de data
        query = query.is('processDate', null);
      }

      if (params.sortBy) {
        query = query.order(params.sortBy.field, { ascending: params.sortBy.order === 'asc' });
      } else {
        query = query.order('entryDate', { ascending: false });
      }

      const from = (params.page - 1) * params.itemsPerPage;
      const to = from + params.itemsPerPage - 1;
      query = query.range(from, to);
    } else {
      query = query.order('entryDate', { ascending: false });
    }

    const { data, count, error } = await query;
    if (error) {
      console.error('Error fetching processes:', error.message);
      return { data: [], count: 0 };
    }
    return { data: data as Process[], count: count || 0 };
  },

  saveProcess: async (process: Process, performedBy: User): Promise<void> => {
    const { processLink, ...processData } = process;
    const payload = {
      ...processData,
      CGOF: normalizeCGOF(process.CGOF),
      processDate: cleanDate(process.processDate),
      deadline: cleanDate(process.deadline),
      process_link: processLink || null
    };
    const { error } = await supabase.from('processes').upsert(payload);
    if (error) throw error;
    await DbService.logAction(process.id ? 'UPDATE' : 'CREATE', `Processo salvo: ${process.number}`, performedBy, process.id);
  },

  updateProcesses: async (ids: string[], updates: Partial<Process>, performedBy: User): Promise<void> => {
    const cleanedUpdates = { ...updates };
    if ('processDate' in cleanedUpdates) cleanedUpdates.processDate = cleanDate(cleanedUpdates.processDate);
    if ('deadline' in cleanedUpdates) cleanedUpdates.deadline = cleanDate(cleanedUpdates.deadline);

    const { error } = await supabase.from('processes').update(cleanedUpdates).in('id', ids);
    if (error) throw error;
    await DbService.logAction('UPDATE', `Atualização em massa: ${ids.length} processos`, performedBy);
  },

  importProcesses: async (processes: Process[], performedBy: User): Promise<void> => {
    const normalized = processes.map(p => {
      const { processLink, ...processData } = p;
      return {
        ...processData,
        CGOF: normalizeCGOF(p.CGOF),
        processDate: cleanDate(p.processDate),
        deadline: cleanDate(p.deadline),
        process_link: processLink || null
      };
    });
    
    const BATCH_SIZE = 100;
    for (let i = 0; i < normalized.length; i += BATCH_SIZE) {
        const chunk = normalized.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('processes').insert(chunk);
        if (error) throw error;
    }
    
    await DbService.logAction('CREATE', `Importação em massa: ${processes.length} processos`, performedBy);
  },

  deleteProcess: async (id: string, performedBy: User): Promise<void> => {
    const { error } = await supabase.from('processes').delete().eq('id', id);
    if (error) throw error;
    await DbService.logAction('DELETE', `Processo excluído (ID: ${id})`, performedBy, id);
  },

  deleteProcesses: async (ids: string[], performedBy: User): Promise<void> => {
    const { error } = await supabase.from('processes').delete().in('id', ids);
    if (error) throw error;
    await DbService.logAction('DELETE', `${ids.length} processos excluídos`, performedBy);
  },

  deleteLastMovement: async (number: string, performedBy: User): Promise<void> => {
    const { data, error: fetchError } = await supabase
      .from('processes')
      .select('id')
      .eq('number', number)
      .order('entryDate', { ascending: false })
      .order('updatedAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!data) return;

    const { error: deleteError } = await supabase.from('processes').delete().eq('id', data.id);
    if (deleteError) throw deleteError;

    await DbService.logAction('DELETE', `Última movimentação excluída para o processo: ${number}`, performedBy, data.id);
  },

  getProcessHistory: async (number: string): Promise<Process[]> => {
    const { data, error } = await supabase
      .from('processes')
      .select('*')
      .eq('number', number)
      .order('entryDate', { ascending: false });
    if (error) throw error;
    return data as Process[];
  },

  getAllProcessesForDashboard: async (): Promise<{ data: Process[], count: number }> => {
    // Busca um volume expressivo de dados para garantir que os cálculos do dashboard sejam precisos
    const { data, count, error } = await supabase
      .from('processes')
      .select('*', { count: 'exact' })
      .limit(30000); // Limite aumentado para cobrir bases grandes
      
    if (error) {
      console.error('Erro ao buscar dados para dashboard:', error.message);
      return { data: [], count: 0 };
    }
    return { data: data as Process[], count: count || 0 };
  },

  getUniqueValues: async (column: 'sector' | 'interested' | 'subject'): Promise<string[]> => {
    const rpcMap = {
      sector: 'distinct_setor',
      interested: 'distinct_interessada',
      subject: 'distinct_assunto'
    };
    const { data, error } = await supabase.rpc(rpcMap[column]);
    if (error) {
      console.error(`Error fetching unique ${column}:`, error.message);
      return [];
    }
    return (data as any[]).map(item => item.value).filter(Boolean);
  },

  // --- LOGS ---
  getLogs: async (): Promise<Log[]> => {
    const { data, error } = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(500);
    if (error) {
      console.error('Error fetching logs:', error.message);
      return [];
    }
    return data as Log[];
  },

  logAction: async (action: Log['action'], description: string, user: User, targetId?: string) => {
    await supabase.from('logs').insert({
      id: crypto.randomUUID(),
      action,
      description,
      userId: user.id,
      userName: user.name,
      timestamp: new Date().toISOString(),
      targetId
    });
  },

  checkAndSeedData: async (user: User) => {
    const { count } = await supabase.from('processes').select('*', { count: 'exact', head: true }).limit(1);
    if (count === 0) {
      const initialDataRaw = getInitialAssessoriaData();
      const initialData = initialDataRaw.map(p => ({
        ...p,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      await DbService.importProcesses(initialData as Process[], user);
    }
  }
};
