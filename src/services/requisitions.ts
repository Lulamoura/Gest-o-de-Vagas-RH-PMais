import pb from '@/lib/pocketbase/client'
import { RequisitionRecord } from '@/types'

const EXPAND = 'solicitante,cliente,cargo,cidade,tipo_vaga,tipo_contrato,departamento'

export const getRequisitions = async () =>
  pb.collection<RequisitionRecord>('requisitions').getFullList({
    sort: '-created',
    expand: EXPAND,
  })

export const getRequisition = async (id: string) =>
  pb.collection<RequisitionRecord>('requisitions').getOne(id, { expand: EXPAND })

export const createRequisition = async (data: Partial<RequisitionRecord>) =>
  pb.collection<RequisitionRecord>('requisitions').create(data, { expand: EXPAND })

export const updateRequisition = async (id: string, data: Partial<RequisitionRecord>) =>
  pb.collection<RequisitionRecord>('requisitions').update(id, data, { expand: EXPAND })

export const deleteRequisition = async (id: string) =>
  pb.collection<RequisitionRecord>('requisitions').delete(id)

export const changeRequisitionStatus = async (id: string, status: string, observacao?: string) =>
  pb.send(`/backend/v1/requisitions/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status, observacao: observacao || '' }),
    headers: { 'Content-Type': 'application/json' },
  })

export interface WordpressDraftPublicacaoIris {
  titulo_publico_iris: string
  descricao_publica_iris: string
  perfil_interno_triagem_iris: string
  suggestion_proof: IrisSuggestionProof
}

export const createWordpressDraft = async (id: string, publicacaoIris: WordpressDraftPublicacaoIris) =>
  pb.send<WordpressDraftResult>(`/backend/v1/requisitions/${id}/wordpress-draft`, {
    method: 'POST',
    body: JSON.stringify({ publicacao_iris: publicacaoIris }),
    headers: { 'Content-Type': 'application/json' },
  })

export interface IrisSuggestionProof {
  request_id: string
  second_brain_version: string
  second_brain_sha256: string
  source_fingerprint: string
  expires_at: number
  signature: string
}

export interface WordpressDraftResult {
  ok: true
  duplicate: boolean
  verified: true
  post_status: 'draft'
  wordpress_job_id: string
  wordpress_admin_url: string
}

export interface IrisJobDescriptionSuggestion {
  ok: boolean
  schema_version: string
  operation: 'generate_job_description_package'
  agent: 'iris'
  fallback: false
  titulo_publico: string
  descricao_publica: string
  texto_wordpress: string
  perfil_interno_triagem: string
  audit: {
    request_id: string
    requisition_id: string
    generated_at: string
    model: string
    second_brain_version: string
    second_brain_sha256: string
  }
  suggestion_proof: IrisSuggestionProof
}

export const suggestRequisitionJobDescription = async (id: string) =>
  pb.send<IrisJobDescriptionSuggestion>(`/backend/v1/iris/requisitions/${id}/job-description`, {
    method: 'POST',
  })
