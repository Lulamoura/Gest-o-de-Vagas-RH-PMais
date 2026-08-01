import { RequisitionStatus, RequisitionDepartamento } from '@/types'

export const DEPARTAMENTO_LABELS: Record<RequisitionDepartamento, string> = {
  comercial: 'Comercial',
  operacional: 'Operacional',
  rh: 'RH',
}

export const REQUISITION_STATUS_BADGE: Record<RequisitionStatus, string> = {
  Rascunho: 'bg-amber-100 text-amber-800 border-amber-200',
  'Aguardando aprovação': 'bg-blue-100 text-blue-800 border-blue-200',
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
