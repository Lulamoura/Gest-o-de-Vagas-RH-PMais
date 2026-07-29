import pb from '@/lib/pocketbase/client'
import { CandidateRecord } from '@/types'

const EXPAND =
  'vacancy_id,vacancy_id.cliente,vacancy_id.cargo,vacancy_id.cidade,vacancy_id.tipo_vaga,vacancy_id.tipo_contrato,vacancy_id.responsavel_rh'

export const getCandidates = async (vacancyId?: string) => {
  if (vacancyId) {
    return pb.collection<CandidateRecord>('candidates').getFullList({
      filter: `vacancy_id = "${vacancyId}"`,
      sort: '-created',
      expand: EXPAND,
    })
  }
  return pb.collection<CandidateRecord>('candidates').getFullList({
    sort: '-created',
    expand: EXPAND,
  })
}

export const getCandidate = async (id: string) => {
  return pb.collection<CandidateRecord>('candidates').getOne(id, {
    expand: EXPAND,
  })
}

export const createCandidate = async (data: Partial<CandidateRecord>) => {
  return pb.collection<CandidateRecord>('candidates').create(data)
}

export const updateCandidate = async (id: string, data: Partial<CandidateRecord>) => {
  return pb.collection<CandidateRecord>('candidates').update(id, data)
}

export const deleteCandidate = async (id: string) => {
  return pb.collection<CandidateRecord>('candidates').delete(id)
}

export const sendComplementDataRequest = async (candidateId: string) => {
  return pb.send('/backend/v1/send-complement-data-request', {
    method: 'POST',
    body: JSON.stringify({ candidate_id: candidateId }),
    headers: { 'Content-Type': 'application/json' },
  })
}

export const sendDisqualificationNotice = async (candidateId: string) => {
  return pb.send('/backend/v1/send-disqualification-notice', {
    method: 'POST',
    body: JSON.stringify({ candidate_id: candidateId }),
    headers: { 'Content-Type': 'application/json' },
  })
}

export const getCandidatePublicData = async (id: string) => {
  return pb.send(`/backend/v1/candidate-public-data/${id}`, { method: 'GET' })
}

export const updateCandidatePublicData = async (id: string, data: Record<string, unknown>) => {
  return pb.send(`/backend/v1/candidate-public-data/${id}`, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })
}
