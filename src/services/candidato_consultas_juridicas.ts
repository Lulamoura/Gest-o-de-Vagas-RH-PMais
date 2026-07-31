import pb from '@/lib/pocketbase/client'
import { CandidatoConsultaJuridicaRecord } from '@/types'

export interface ProcessAnalysis {
  analise_risco: string
  detalhamento_partes: string
  movimentacoes_relevantes: string
  recomendacao_rh: string
}

export const getLatestConsultaJuridica = async (
  candidateId: string,
): Promise<CandidatoConsultaJuridicaRecord | null> => {
  try {
    const records = await pb
      .collection('candidato_consultas_juridicas')
      .getList<CandidatoConsultaJuridicaRecord>(1, 1, {
        filter: `candidato_id = "${candidateId}"`,
        sort: '-created',
        expand: 'consultado_por,candidato_id',
      })
    return records.items[0] || null
  } catch {
    return null
  }
}

export const getConsultaJuridicaHistory = async (
  candidateId: string,
): Promise<CandidatoConsultaJuridicaRecord[]> => {
  return pb
    .collection('candidato_consultas_juridicas')
    .getFullList<CandidatoConsultaJuridicaRecord>({
      filter: `candidato_id = "${candidateId}"`,
      sort: '-created',
      expand: 'consultado_por,candidato_id',
    })
}

export const performConsultaJuridica = async (
  candidateId: string,
): Promise<CandidatoConsultaJuridicaRecord> => {
  return pb.send(`/backend/v1/candidatos/${candidateId}/consulta-juridica`, {
    method: 'POST',
  })
}

export const getProcessoDetalhes = async (
  processoId: string,
  consultaId?: string,
  numeroProcesso?: string,
  candidatoId?: string,
  cpf?: string,
): Promise<any> => {
  const cleanId = encodeURIComponent(processoId.trim())
  const query: Record<string, string> = {}
  if (consultaId) query.consulta_id = consultaId
  if (numeroProcesso) query.numero_processo = numeroProcesso
  if (candidatoId) query.candidato_id = candidatoId
  if (cpf) query.cpf = cpf

  return pb.send(`/backend/v1/processo/${cleanId}`, {
    method: 'GET',
    query,
  })
}

export interface ResumoIAResult {
  success: boolean
  summary?: string
  message?: string
}

export const gerarResumoIA = async (
  numeroProcesso: string,
  consultaId: string,
): Promise<ResumoIAResult> => {
  if (!numeroProcesso || !consultaId) {
    return { success: false, message: 'Número do processo e ID da consulta são obrigatórios' }
  }

  try {
    const result = await pb.send(`/backend/v1/processo/resumo-ia`, {
      method: 'POST',
      body: JSON.stringify({
        numero_processo: numeroProcesso,
        consulta_id: consultaId,
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    return { success: true, summary: result.message }
  } catch (err: any) {
    const backendMessage =
      err?.response?.message ?? err?.data?.message ?? err?.response?.data?.message
    if (backendMessage && typeof backendMessage === 'string') {
      return { success: false, message: backendMessage }
    }
    if (err?.status === 0 || err?.isAbort) {
      return { success: false, message: 'Erro de conexão. Tente novamente.' }
    }
    const errMsg = err?.message
    if (
      errMsg &&
      typeof errMsg === 'string' &&
      errMsg !== 'Something went wrong while processing your request.'
    ) {
      return { success: false, message: errMsg }
    }
    return { success: false, message: 'Erro de conexão. Tente novamente.' }
  }
}

export const getProcessoAnaliseDetalhada = async (
  consultaId: string,
  processoId: string,
): Promise<ProcessAnalysis> => {
  if (!consultaId || !processoId) {
    throw new Error('ID da consulta e ID do processo são obrigatórios')
  }

  return pb.send(`/backend/v1/processo/analise-detalhada`, {
    method: 'POST',
    body: JSON.stringify({
      consulta_id: consultaId,
      processo_id: processoId,
    }),
    headers: { 'Content-Type': 'application/json' },
  })
}
