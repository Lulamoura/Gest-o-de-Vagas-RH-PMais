import pb from '@/lib/pocketbase/client'
import { PipelineHistoryRecord } from '@/types'

export const getPipelineHistory = async (vacancyId: string) => {
  return pb.collection<PipelineHistoryRecord>('pipeline_history').getFullList({
    filter: `vacancy_id = "${vacancyId}"`,
    sort: '-data_mudanca',
    expand: 'usuario_id',
  })
}

export const getAllPipelineHistory = async () => {
  return pb.collection<PipelineHistoryRecord>('pipeline_history').getFullList({
    sort: 'created',
  })
}

export const createPipelineHistory = async (data: Partial<PipelineHistoryRecord>) => {
  return pb.collection<PipelineHistoryRecord>('pipeline_history').create(data)
}
