import pb from '@/lib/pocketbase/client'
import { CandidateRecord } from '@/types'

export const getCandidates = (filter = '', sort = '-created') =>
  pb.collection('candidates').getFullList<CandidateRecord>({
    filter,
    sort,
    expand: 'vacancy_id,vacancy_id.cargo,vacancy_id.cliente',
  })

export const getCandidate = (id: string) =>
  pb.collection('candidates').getOne<CandidateRecord>(id, {
    expand: 'vacancy_id,vacancy_id.cargo,vacancy_id.cliente,vacancy_id.cidade',
  })

export const createCandidate = (data: Partial<CandidateRecord>) =>
  pb.collection('candidates').create<CandidateRecord>(data)

export const updateCandidate = (id: string, data: Partial<CandidateRecord>) =>
  pb.collection('candidates').update<CandidateRecord>(id, data)

export const deleteCandidate = (id: string) => pb.collection('candidates').delete(id)

export const sendComplementDataRequest = (candidateId: string) =>
  pb.send('/backend/v1/send-complement-data-request', {
    method: 'POST',
    body: JSON.stringify({ candidate_id: candidateId, candidateId }),
    headers: { 'Content-Type': 'application/json' },
  })

export const sendDisqualificationNotice = (candidateId: string) =>
  pb.send('/backend/v1/send-disqualification-notice', {
    method: 'POST',
    body: JSON.stringify({ candidate_id: candidateId, candidateId }),
    headers: { 'Content-Type': 'application/json' },
  })

export const sendExamReferral = (
  candidateId: string,
  clinicaId: string,
  comentario: string,
  custoExames: number,
) =>
  pb.send('/backend/v1/send-encaminhamento-exames', {
    method: 'POST',
    body: JSON.stringify({
      candidate_id: candidateId,
      candidateId,
      clinica_id: clinicaId,
      clinicaId,
      comentario,
      custo_exames: custoExames,
      custoExames,
    }),
    headers: { 'Content-Type': 'application/json' },
  })

export const getCandidatePublicData = (candidateId: string) =>
  pb.send(`/backend/v1/candidate-public-data/${candidateId}`, { method: 'GET' })

export const updateCandidatePublicData = (candidateId: string, data: any) =>
  pb.send(`/backend/v1/candidate-public-data/${candidateId}`, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })
