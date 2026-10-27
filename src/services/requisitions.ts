import pb from '@/lib/pocketbase/client'
import { resolveIrisGvBrowserAdapterBaseUrl } from '@/services/irisAdapterUrl'
import { RequisitionRecord } from '@/types'

const EXPAND = 'solicitante,cliente,cargo,cidade,tipo_vaga,tipo_contrato,departamento'

interface BrowserAdapterErrorBody {
  detail?: { code?: string; message?: string } | string
  message?: string
}

export class IrisBrowserAdapterError extends Error {
  constructor(
    message: string,
    public readonly code: string | null,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'IrisBrowserAdapterError'
  }
}

export const isIrisHermesUnavailableSuggestionError = (
  error: unknown,
): error is IrisBrowserAdapterError =>
  error instanceof IrisBrowserAdapterError && error.code === 'IRIS_HERMES_UNAVAILABLE'

interface BrowserAdapterRequestOptions {
  method: 'GET' | 'POST'
  body?: unknown
}

const isBrowserAdapterRequestOptions = (value: unknown): value is BrowserAdapterRequestOptions =>
  typeof value === 'object' &&
  value !== null &&
  'method' in value &&
  ((value as BrowserAdapterRequestOptions).method === 'GET' ||
    (value as BrowserAdapterRequestOptions).method === 'POST')

export const irisBrowserAdapterRequest = async <T>(
  path: string,
  bodyOrOptions: unknown,
  origin: string = window.location.origin,
): Promise<T> => {
  const baseUrl = resolveIrisGvBrowserAdapterBaseUrl(origin)
  const token = pb.authStore.token
  if (!token) {
    throw new Error('Sua sessão expirou. Entre novamente para usar a Íris.')
  }
  const options = isBrowserAdapterRequestOptions(bodyOrOptions)
    ? bodyOrOptions
    : { method: 'POST' as const, body: bodyOrOptions }
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  const request: RequestInit = { method: options.method, headers }
  if (options.method === 'POST') {
    headers['Content-Type'] = 'application/json'
    request.body = JSON.stringify(options.body)
  }
  const response = await fetch(`${baseUrl}${path}`, request)
  const responseBody = (await response.json().catch(() => null)) as
    | BrowserAdapterErrorBody
    | T
    | null
  if (!response.ok) {
    const detail = (responseBody as BrowserAdapterErrorBody | null)?.detail
    const code = typeof detail === 'object' && typeof detail?.code === 'string' ? detail.code : null
    const message =
      (typeof detail === 'object' && detail?.message) ||
      (typeof detail === 'string' && detail) ||
      (responseBody as BrowserAdapterErrorBody | null)?.message ||
      'Não foi possível concluir a ação da Íris.'
    throw new IrisBrowserAdapterError(message, code, response.status)
  }
  return responseBody as T
}

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

export const createWordpressDraft = async (
  id: string,
  publicacaoIris: WordpressDraftPublicacaoIris,
) =>
  irisBrowserAdapterRequest<WordpressDraftResult>(
    `/v1/pessoas/iris/gv-rh/browser/requisitions/${encodeURIComponent(id)}/wordpress-draft`,
    { publicacao_iris: publicacaoIris },
  )

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

export type IrisOperationalState = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'UNKNOWN'

export interface IrisOperationalStatus {
  status: IrisOperationalState
  manual_contingency_allowed: boolean
  last_successful_check_at: string | null
}

export const getIrisOperationalStatus = async () =>
  irisBrowserAdapterRequest<IrisOperationalStatus>(
    '/v1/pessoas/iris/gv-rh/browser/operational-status',
    { method: 'GET' },
  )

export interface ManualContingencyPublication {
  titulo_publico: string
  descricao_publica: string
  perfil_interno_triagem: string
  confirmacao_explicita: true
}

export const createManualContingencyWordpressDraft = async (
  id: string,
  payload: ManualContingencyPublication,
) =>
  irisBrowserAdapterRequest<WordpressDraftResult>(
    `/v1/pessoas/iris/gv-rh/browser/requisitions/${encodeURIComponent(id)}/wordpress-draft-manual`,
    {
      publicacao_manual: {
        titulo_publico: payload.titulo_publico,
        descricao_publica: payload.descricao_publica,
        perfil_interno_triagem: payload.perfil_interno_triagem,
        confirmacao_explicita: payload.confirmacao_explicita,
      },
    },
  )

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
  irisBrowserAdapterRequest<IrisJobDescriptionSuggestion>(
    `/v1/pessoas/iris/gv-rh/browser/requisitions/${encodeURIComponent(id)}/job-description-package`,
    {},
  )
