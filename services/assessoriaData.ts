
import { Process } from '../types';

// Função auxiliar para converter data DD/MM/YYYY para YYYY-MM-DD
const parseDate = (dateStr: string): string => {
  if (!dateStr) return ''; // Return empty if no date, preventing "today" default for deadlines
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    // Check if parts are valid numbers
    if (!isNaN(Number(parts[0])) && !isNaN(Number(parts[1])) && !isNaN(Number(parts[2]))) {
       // YYYY-MM-DD
       return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  // If parsing fails, return empty string instead of today to avoid wrong data
  return ''; 
};

const rawData = `ENTRADA	NUMERO 	INTERESSADA	 ASSUNTO 	SETOR	DATA
13/06/2023	024.00025550/2023-59	 Deputado Estadual Atila Jacomussi 	 Solicitação de retomada do repasse ao Hospital Nardini em Mauá e parcelamento dos valores atrasados 	GS/RECEBIMENTO	13/06/2023
13/06/2023	024.00001094/2023-51	 IRMANDADE DA SANTA CASA DE MISERICÓRDIA DE MARÍLIA 	 Ofício nº 230/2023 S.A - Solicita apoio financeiro emergencial mensal no valor de R$ 1.200.000,00 	GS/RECEBIMENTO	13/06/2023
13/06/2023	024.00003357/2023-67	 Fundação Hospital Regional do Câncer da Santa Casa de Mis de Presidente Prudente 	 Solicitação Recursos Financeiros para Hospital do Câncer no valor de R$ 30.000.000,00 	GS/RECEBIMENTO	13/06/2023
13/06/2023	024.00000243/2023-65	 Santa Casa de Misericórdia e Asilo dos Pobres de Batatais 	 Solicitação de prorrogação do Convênio N° 000926/2022 do Programa Mais Santas Casas. Demanda n° 37982 	GS/RECEBIMENTO	13/06/2023
13/06/2023	024.00000529/2023-41	 Santa Casa de Sertãozinho 	 Prorrogação da Vigência do Convênio nº 000768/2022 - Processo SES-PCR-2022-00450-DM - PROGRAMA MAIS Santas Casas 	GS/RECEBIMENTO	13/06/2023
04/12/2025	024.00176413/2025-43	Ministério da Saúde - Secretaria de Atenção Especializada à Saúde	Ofício nº 1126/2025 - Ofício de Monitoramento - 13851748000118012 	SES-GS-ATG8	04/12/2025
04/12/2025	024.00176357/2025-47	Ministério da Saúde - Secretaria de Atenção Especializada à Saúde	Ofício nº 1125/2025 - Ofício de Monitoramento - 13851748000118013	SES-GS-ATG8	04/12/2025`;

type ProcessSeedData = Omit<Process, 'id' | 'createdAt' | 'updatedAt'>;

export const getInitialAssessoriaData = (): ProcessSeedData[] => {
  const lines = rawData.trim().split('\n');
  // Skip header
  const dataLines = lines.slice(1);

  return dataLines.map((line): ProcessSeedData | null => {
    // Split by tab or multiple spaces if tab is missing
    const columns = line.split('\t').map(c => c.trim());
    
    // Fallback if split failed (sometimes copy-paste converts tabs to spaces)
    if (columns.length < 2) return null;

    const entryDate = parseDate(columns[0]) || new Date().toISOString().split('T')[0]; // Keep today for entry date if missing
    const number = columns[1] || 'S/N';
    const interested = columns[2] || '';
    const subject = columns[3] || '';
    // Mapping column 4 to CGOF as it seems to contain sector/department codes
    const cgofValue = columns[4] || ''; 
    
    // The raw data has dates in column 5 (index 5) which seems to be Process Date
    const processDate = parseDate(columns[5]) || entryDate;
    
    // Deadline is empty by default for imported data
    const deadline = '';

    return {
      category: 'Assessoria',
      CGOF: cgofValue, // Uppercase property
      entryDate,
      number,
      interested,
      subject,
      sector: cgofValue, // Keeping sector synced with CGOF for now as per original data structure
      processDate: processDate,
      urgent: false,
      deadline, // Empty string
      observations: '',
      createdBy: 'system',
      updatedBy: 'system'
    };
  }).filter((item): item is ProcessSeedData => item !== null);
};
