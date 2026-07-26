import pb from '@/lib/pocketbase/client'
import { CandidateRecord } from '@/types'

const EXPAND =
  'vacancy_id.cliente,vacancy_id.cargo,vacancy_id.cidade,vacancy_id.tipo_vaga,vacancy_id.responsavel_rh'

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
