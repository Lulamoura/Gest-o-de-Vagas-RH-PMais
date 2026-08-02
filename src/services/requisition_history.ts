import pb from '@/lib/pocketbase/client'
import { RequisitionHistoryRecord } from '@/types'

const EXPAND = 'usuario_id'

export const getRequisitionHistory = async (requisitionId: string) =>
  pb.collection<RequisitionHistoryRecord>('requisition_history').getFullList({
    filter: `requisition_id = "${requisitionId}"`,
    sort: '-data_mudanca',
    expand: EXPAND,
  })

export const createRequisitionHistory = async (data: Partial<RequisitionHistoryRecord>) =>
  pb.collection<RequisitionHistoryRecord>('requisition_history').create(data, { expand: EXPAND })
