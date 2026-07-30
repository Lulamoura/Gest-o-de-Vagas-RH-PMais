import pb from '@/lib/pocketbase/client'
import { CandidatoConsultaJuridicaRecord } from '@/types'

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
  return pb.send(`/backend/v1/candidato/${candidateId}/consulta-juridica`, {
    method: 'POST',
  })
}

export const getProcessoDetalhes = async (processoId: string): Promise<any> => {
  return pb.send(`/backend/v1/processo/${encodeURIComponent(processoId.trim())}`, {
    method: 'GET',
  })
}

export const getProcessoResumoIA = async (
  numeroProcesso: string,
  consultaId?: string,
): Promise<{ summary: string }> => {
  if (!numeroProcesso || !consultaId) {
    throw new Error('Número do processo e ID da consulta são obrigatórios')
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (pb.authStore.token) {
    headers['Authorization'] = pb.authStore.token
  }

  return pb.send(`/backend/v1/processo/resumo-ia`, {
    method: 'POST',
    body: JSON.stringify({
      numero_processo: numeroProcesso,
      consulta_id: consultaId,
      numeroProcesso,
      consultaId,
    }),
    headers,
  })
}
