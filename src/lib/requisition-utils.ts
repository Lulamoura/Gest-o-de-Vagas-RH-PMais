import { RequisitionStatus, RequisitionDepartamento, RequisitionRecord } from '@/types'

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
  'Rascunho criado no WordPress': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  Publicada: 'bg-teal-100 text-teal-800 border-teal-200',
}

export const REQUISITION_STATUS_LABELS: Record<RequisitionStatus, string> = {
  Rascunho: 'Rascunho',
  'Aguardando aprovação': 'Aguardando Aprovação',
  'Em análise': 'Em Análise',
  Aprovada: 'Aprovada',
  Reprovada: 'Reprovada',
  Cancelada: 'Cancelada',
  'Rascunho criado no WordPress': 'Rascunho no WordPress',
  Publicada: 'Publicada',
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

export function getMissingApprovalFields(req: Partial<RequisitionRecord>): string[] {
  const missing: string[] = []
  if (!req.cliente) missing.push('Cliente')
  if (!req.cargo) missing.push('Cargo')
  if (!req.cidade) missing.push('Cidade')
  if (!req.tipo_vaga) missing.push('Tipo de Vaga')
  if (!req.tipo_contrato) missing.push('Tipo de Contrato')
  if (!req.departamento) missing.push('Departamento')
  if (!req.quantidade_vagas || req.quantidade_vagas < 1) missing.push('Quantidade de Vagas')
  if (!req.prazo_desejado?.trim()) missing.push('Prazo Desejado')
  if (!req.prioridade?.trim()) missing.push('Prioridade')
  if (!req.faixa_salarial?.trim()) missing.push('Faixa Salarial')
  if (!req.justificativa?.trim()) missing.push('Justificativa')
  if (!req.especificacoes?.trim()) missing.push('Especificações')
  if (!req.numero_oe?.trim()) missing.push('Número da OE')
  return missing
}
