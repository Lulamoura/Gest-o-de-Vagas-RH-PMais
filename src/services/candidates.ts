import pb from '@/lib/pocketbase/client'
import { CandidateRecord } from '@/types'

export const getCandidates = async (vacancyId?: string) => {
  if (vacancyId) {
    return pb.collection<CandidateRecord>('candidates').getFullList({
      filter: `vacancy_id = "${vacancyId}"`,
      sort: '-created',
      expand: 'vacancy_id',
    })
  }
  return pb.collection<CandidateRecord>('candidates').getFullList({
    sort: '-created',
    expand: 'vacancy_id',
  })
}

export const getCandidate = async (id: string) => {
  return pb.collection<CandidateRecord>('candidates').getOne(id, {
    expand: 'vacancy_id',
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
