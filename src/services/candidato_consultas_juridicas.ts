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

export const getProcessoResumoIA = async (
  numeroProcesso: string,
  consultaId?: string,
): Promise<{ summary: string }> => {
  if (!numeroProcesso || !consultaId) {
    throw new Error('Número do processo e ID da consulta são obrigatórios')
  }

  return pb.send(`/backend/v1/processo/resumo-ia`, {
    method: 'POST',
    body: JSON.stringify({
      numero_processo: numeroProcesso,
      consulta_id: consultaId,
    }),
    headers: { 'Content-Type': 'application/json' },
  })
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
