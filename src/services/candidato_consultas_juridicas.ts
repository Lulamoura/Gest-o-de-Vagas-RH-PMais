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
