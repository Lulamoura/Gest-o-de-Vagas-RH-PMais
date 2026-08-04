import pb from '@/lib/pocketbase/client'
import type { CandidateRecord } from '@/types'

const EXPAND =
  'vacancy_id,vacancy_id.cliente,vacancy_id.cargo,vacancy_id.cidade,vacancy_id.tipo_vaga,vacancy_id.tipo_contrato,vacancy_id.responsavel_rh'

export const getCandidates = async (filter?: string): Promise<CandidateRecord[]> => {
  return await pb.collection('candidates').getFullList({
    filter: filter || '',
    expand: EXPAND,
    sort: '-created',
  })
}

export const getIntegrationCandidates = async (): Promise<CandidateRecord[]> => {
  return await pb.collection('candidates').getFullList({
    filter: 'integracao_ativa = true && status_candidato = "Cadastro DP"',
    expand: EXPAND,
    sort: '-data_integracao',
  })
}

export const getCandidate = async (id: string): Promise<CandidateRecord> => {
  return await pb.collection('candidates').getOne(id, { expand: EXPAND })
}

export const createCandidate = async (data: Partial<CandidateRecord>): Promise<CandidateRecord> => {
  return await pb.collection('candidates').create(data)
}

export const updateCandidate = async (
  id: string,
  data: Partial<CandidateRecord>,
): Promise<CandidateRecord> => {
  return await pb.collection('candidates').update(id, data)
}

export const deleteCandidate = async (id: string): Promise<void> => {
  await pb.collection('candidates').delete(id)
}

export const sendComplementDataRequest = async (candidateId: string): Promise<any> => {
  return await pb.send('/backend/v1/send-complement-data-request', {
    method: 'POST',
    body: JSON.stringify({ candidate_id: candidateId }),
    headers: { 'Content-Type': 'application/json' },
  })
}

export const sendDisqualificationNotice = async (candidateId: string): Promise<any> => {
  return await pb.send('/backend/v1/send-disqualification-notice', {
    method: 'POST',
    body: JSON.stringify({ candidate_id: candidateId }),
    headers: { 'Content-Type': 'application/json' },
  })
}

export const sendExamReferral = async (candidateId: string, clinicaId: string): Promise<any> => {
  return await pb.send('/backend/v1/send-encaminhamento-exames', {
    method: 'POST',
    body: JSON.stringify({ candidate_id: candidateId, clinica_id: clinicaId }),
    headers: { 'Content-Type': 'application/json' },
  })
}

export const getCandidatePublicData = async (id: string): Promise<any> => {
  return await pb.send(`/backend/v1/candidate-public-data/${id}`, { method: 'GET' })
}

export const updateCandidatePublicData = async (id: string, data: any): Promise<any> => {
  return await pb.send(`/backend/v1/candidate-public-data/${id}`, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })
}

export const sendAvisoIntegracaoCandidato = async (
  candidateId: string,
  baseId?: string,
): Promise<any> => {
  const payload: Record<string, string> = { candidate_id: candidateId }
  if (baseId) payload.base_id = baseId
  return await pb.send('/backend/v1/send-aviso-integracao-candidato', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  })
}
