import pb from '@/lib/pocketbase/client'
import { CandidateHistoryRecord } from '@/types'

export const getCandidateHistory = async (vacancyId: string) => {
  return pb.collection<CandidateHistoryRecord>('candidate_history').getFullList({
    filter: `vacancy_id = "${vacancyId}"`,
    sort: '-data_mudanca',
    expand: 'candidate_id,usuario_id',
  })
}

export const getLatestCandidateHistory = async (
  candidateId: string,
): Promise<CandidateHistoryRecord | null> => {
  try {
    const list = await pb.collection<CandidateHistoryRecord>('candidate_history').getList(1, 1, {
      filter: `candidate_id = "${candidateId}"`,
      sort: '-data_mudanca',
    })
    return list.items[0] || null
  } catch {
    return null
  }
}

export const createCandidateHistory = async (data: Partial<CandidateHistoryRecord>) => {
  return pb.collection<CandidateHistoryRecord>('candidate_history').create(data)
}
