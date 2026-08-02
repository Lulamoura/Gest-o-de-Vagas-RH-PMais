import pb from '@/lib/pocketbase/client'
import { RequisitionCommentRecord } from '@/types'

const EXPAND = 'usuario_id'

export const getRequisitionComments = async (requisitionId: string) =>
  pb.collection<RequisitionCommentRecord>('requisition_comments').getFullList({
    filter: `requisition_id = "${requisitionId}"`,
    sort: 'created',
    expand: EXPAND,
  })

export const createRequisitionComment = async (data: Partial<RequisitionCommentRecord>) =>
  pb.collection<RequisitionCommentRecord>('requisition_comments').create(data, { expand: EXPAND })

export const deleteRequisitionComment = async (id: string) =>
  pb.collection<RequisitionCommentRecord>('requisition_comments').delete(id)
