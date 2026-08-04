import pb from '@/lib/pocketbase/client'
import { CandidateEmailLogRecord, EmailType } from '@/types'

export const getEmailLogsForCandidate = async (candidateId: string) => {
  return pb.collection<CandidateEmailLogRecord>('candidate_email_log').getFullList({
    filter: `candidate_id = "${candidateId}"`,
    sort: '-created',
  })
}

export const hasEmailBeenSent = (logs: CandidateEmailLogRecord[], type: EmailType): boolean => {
  return logs.some((log) => log.email_type === type)
}

export const getEmailLogsForCandidates = async (candidateIds: string[]) => {
  if (candidateIds.length === 0) return []
  const filter = candidateIds.map((id) => `candidate_id = "${id}"`).join(' || ')
  return pb.collection<CandidateEmailLogRecord>('candidate_email_log').getFullList({
    filter,
    sort: '-created',
  })
}
