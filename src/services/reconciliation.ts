import pb from '@/lib/pocketbase/client'

export interface VacancySnapshot {
  id: string
  wordpress_job_id: string
  cliente: string
  cargo: string
  cidade: string
  tipo_vaga: string
  tipo_contrato: string
  quantidade_vagas: number
  salario_faixa: string
  prioridade: string
  especificacoes: string
  observacoes_internas: string
  perfil_interno: string
  responsavel_operacional: string
  ordem_execucao: string
  prazo_desejado: string
  data_abertura: string
  link_publico: string
  origem: string
  status_vaga: string
  updated: string
}

export interface RequisitionSnapshot {
  id: string
  status: string
  wordpress_job_id: string
  wordpress_sync_status: string
  wordpress_sync_date: string
  link_publico: string
  data_publicacao: string
}

export interface ReconciliationSnapshot {
  vacancy: VacancySnapshot | null
  vacancy_count: number
  requisition: RequisitionSnapshot | null
}

export interface ReconciliationResult {
  ok: boolean
  import_status: number
  import_response: Record<string, unknown> | null
  payload: Record<string, unknown>
  pre_snapshot: ReconciliationSnapshot
  post_snapshot: ReconciliationSnapshot | null
}

export const executeReconciliation = async (params: {
  vacancy_id: string
  requisition_id: string
  wordpress_job_id: string
}): Promise<ReconciliationResult> => {
  return pb.send('/backend/v1/reconcile-vacancy', {
    method: 'POST',
    body: JSON.stringify(params),
    headers: { 'Content-Type': 'application/json' },
  })
}
