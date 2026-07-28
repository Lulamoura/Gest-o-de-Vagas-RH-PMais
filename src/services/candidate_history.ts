import pb from '@/lib/pocketbase/client'
import { CandidateHistoryRecord } from '@/types'

export const getCandidateHistory = async (vacancyId: string) => {
  return pb.collection<CandidateHistoryRecord>('candidate_history').getFullList({
    filter: `vacancy_id = "${vacancyId}"`,
    sort: '-data_mudanca',
    expand: 'candidate_id,usuario_id',
  })
}

export const createCandidateHistory = async (data: Partial<CandidateHistoryRecord>) => {
  return pb.collection<CandidateHistoryRecord>('candidate_history').create(data)
}
