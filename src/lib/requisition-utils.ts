import { RequisitionStatus, RequisitionDepartamento } from '@/types'

export const DEPARTAMENTO_LABELS: Record<RequisitionDepartamento, string> = {
  comercial: 'Comercial',
  operacional: 'Operacional',
  rh: 'RH',
}

export const REQUISITION_STATUS_BADGE: Record<RequisitionStatus, string> = {
  Rascunho: 'bg-amber-100 text-amber-800 border-amber-200',
  'Aguardando aprovação': 'bg-blue-100 text-blue-800 border-blue-200',
  'Em análise': 'bg-purple-100 text-purple-800 border-purple-200',
  Aprovada: 'bg-green-100 text-green-800 border-green-200',
  Reprovada: 'bg-rose-100 text-rose-800 border-rose-200',
  Cancelada: 'bg-slate-200 text-slate-700 border-slate-300',
}

export const REQUISITION_STATUS_LABELS: Record<RequisitionStatus, string> = {
  Rascunho: 'Rascunho',
  'Aguardando aprovação': 'Aguardando Aprovação',
  'Em análise': 'Em Análise',
  Aprovada: 'Aprovada',
  Reprovada: 'Reprovada',
  Cancelada: 'Cancelada',
}

export const DEPARTAMENTO_OPTIONS = [
  { value: 'comercial', label: 'Comercial' },
  { value: 'operacional', label: 'Operacional' },
  { value: 'rh', label: 'RH' },
]

export const WIZARD_STEPS = [
  { num: 1, title: 'Dados da Vaga' },
  { num: 2, title: 'Condições da Vaga' },
  { num: 3, title: 'Justificativa' },
  { num: 4, title: 'Revisão' },
]
