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
