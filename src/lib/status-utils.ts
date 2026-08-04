import { VacancyStatus, CandidateStatus, VacancyPriority } from '@/types'

export const PIPELINE_PHASES = [
  'Aberta',
  'Triagem',
  'Entrevistas',
  'Pré-Aprovação',
  'Contratação',
  'Fechada',
  'Cancelada',
] as const

export type PipelinePhase = (typeof PIPELINE_PHASES)[number]

export const VACANCY_STATUS_OPTIONS: VacancyStatus[] = ['Aberta', 'Concluída', 'Cancelada']

export const VACANCY_STATUS_LABELS: Record<VacancyStatus, string> = {
  Aberta: 'Aberta',
  Concluída: 'Fechada',
  Cancelada: 'Cancelada',
}

export const CANDIDATE_STATUS_TO_PHASE: Record<CandidateStatus, PipelinePhase | null> = {
  'Análise do RH': 'Triagem',
  'Análise do gestor': 'Entrevistas',
  'Documentação e exame': 'Pré-Aprovação',
  'Cadastro DP': 'Contratação',
  Integrado: 'Fechada',
  Desistente: null,
  Desclassificado: null,
  'Em banco': null,
}

export const getVacancyStatusBadgeClass = (status: VacancyStatus) => {
  switch (status) {
    case 'Aberta':
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300'
    case 'Concluída':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300'
    case 'Cancelada':
      return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export const getPriorityBadgeClass = (priority: VacancyPriority) => {
  switch (priority) {
    case 'Alta':
      return 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 font-semibold'
    case 'Média':
      return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300'
    case 'Baixa':
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export const getCandidateStatusBadgeClass = (status: CandidateStatus) => {
  switch (status) {
    case 'Análise do RH':
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300'
    case 'Análise do gestor':
      return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300'
    case 'Documentação e exame':
      return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300'
    case 'Cadastro DP':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300'
    case 'Integrado':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300'
    case 'Desistente':
      return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300'
    case 'Desclassificado':
      return 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300'
    case 'Em banco':
      return 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export const calculateDaysOpen = (dataAbertura?: string, dataFechamento?: string) => {
  if (!dataAbertura) return 0
  const start = new Date(dataAbertura).getTime()
  const end = dataFechamento ? new Date(dataFechamento).getTime() : Date.now()
  const diffTime = Math.max(0, end - start)
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

export const formatCurrency = (val?: number) => {
  if (val === undefined || val === null) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}

export const formatDateBR = (dateStr?: string) => {
  if (!dateStr) return '-'
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-')
      return `${day}/${month}/${year}`
    }
    const d = new Date(dateStr)
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
      const day = String(d.getUTCDate()).padStart(2, '0')
      const month = String(d.getUTCMonth() + 1).padStart(2, '0')
      const year = d.getUTCFullYear()
      return `${day}/${month}/${year}`
    }
    return d.toLocaleDateString('pt-BR')
  } catch (_) {
    return dateStr
  }
}

export interface VacancyRequiredFields {
  quantidade_vagas?: number
  data_abertura?: string
  prazo_desejado?: string
  responsavel_rh?: string
  responsavel_operacional?: string
  prioridade?: string
  salario_faixa?: string
  cliente?: string
  cargo?: string
  cidade?: string
  tipo_vaga?: string
  tipo_contrato?: string
}

export const getMissingRequiredFields = (fields: VacancyRequiredFields): string[] => {
  const missing: string[] = []
  if (!fields.quantidade_vagas || fields.quantidade_vagas < 1) missing.push('Quantidade de Vagas')
  if (!fields.data_abertura) missing.push('Data de Abertura')
  if (!fields.prazo_desejado) missing.push('Prazo Desejado')
  if (!fields.responsavel_rh) missing.push('Responsável RH')
  if (!fields.responsavel_operacional) missing.push('Responsável Operacional')
  if (!fields.prioridade) missing.push('Prioridade')
  if (!fields.salario_faixa) missing.push('Faixa Salarial')
  if (!fields.cliente) missing.push('Cliente')
  if (!fields.cargo) missing.push('Cargo')
  if (!fields.cidade) missing.push('Cidade')
  if (!fields.tipo_vaga) missing.push('Tipo de Vaga')
  if (!fields.tipo_contrato) missing.push('Tipo de Contrato')
  return missing
}

export const toDateInputValue = (dateStr?: string): string => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    return d.toISOString().split('T')[0]
  } catch {
    return ''
  }
}
