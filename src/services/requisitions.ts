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
  titulo_publico_iris?: string
  descricao_publica_iris?: string
}

export const createWordpressDraft = async (
  id: string,
  publicacaoIris?: WordpressDraftPublicacaoIris,
) =>
  pb.send(`/backend/v1/requisitions/${id}/wordpress-draft`, {
    method: 'POST',
    body: publicacaoIris ? JSON.stringify({ publicacao_iris: publicacaoIris }) : undefined,
    headers: publicacaoIris ? { 'Content-Type': 'application/json' } : undefined,
  })

export interface IrisJobDescriptionSuggestion {
  ok: boolean
  fallback?: boolean
  titulo_publico?: string
  descricao?: string
  atividades?: string[]
  requisitos?: string[]
  diferenciais?: string[]
  alerta_publicacao?: string[]
  texto_wordpress?: string
  audit?: {
    origem: string
    provider?: string
    modelo?: string
    exemplos_wordpress?: number
  }
}

export const suggestRequisitionJobDescription = async (id: string) =>
  pb.send<IrisJobDescriptionSuggestion>(`/backend/v1/iris/requisitions/${id}/job-description`, {
    method: 'POST',
  })
