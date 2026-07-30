import pb from '@/lib/pocketbase/client'
import { CandidatoConsultaJuridicaRecord } from '@/types'

export const getLatestConsultaJuridica = async (candidateId: string) => {
  const results = await pb
    .collection<CandidatoConsultaJuridicaRecord>('candidato_consultas_juridicas')
    .getList(1, 1, {
      filter: `candidato_id = "${candidateId}"`,
      sort: '-created',
      expand: 'consultado_por',
    })
  return results.items[0] || null
}

export const getConsultaJuridicaHistory = async (candidateId: string) => {
  const results = await pb
    .collection<CandidatoConsultaJuridicaRecord>('candidato_consultas_juridicas')
    .getFullList({
      filter: `candidato_id = "${candidateId}"`,
      sort: '-created',
      expand: 'consultado_por',
    })
  return results
}

export const performConsultaJuridica = async (candidateId: string) => {
  try {
    return await pb.send(`/backend/v1/candidatos/${candidateId}/consulta-juridica`, {
      method: 'POST',
    })
  } catch (err: any) {
    const resp = err?.response || {}
    const message =
      resp.error || resp.message || err?.message || 'Erro ao realizar consulta jurídica'
    throw new Error(message)
  }
}

export const getProcessoDetalhes = async (numeroProcesso: string) => {
  try {
    return await pb.send(`/backend/v1/processo/${encodeURIComponent(numeroProcesso)}`, {
      method: 'GET',
    })
  } catch (err: any) {
    const resp = err?.response || {}
    const message =
      resp.error || resp.message || err?.message || 'Erro ao buscar detalhes do processo'
    throw new Error(message)
  }
}

export const getProcessoResumoIA = async (numeroProcesso: string, consultaId: string) => {
  try {
    return await pb.send('/backend/v1/processo/resumo-ia', {
      method: 'POST',
      body: JSON.stringify({ numero_processo: numeroProcesso, consulta_id: consultaId }),
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    const resp = err?.response || {}
    const message =
      resp.error ||
      resp.message ||
      err?.message ||
      'Não foi possível obter o resumo. Tente novamente mais tarde.'
    throw new Error(message)
  }
}
