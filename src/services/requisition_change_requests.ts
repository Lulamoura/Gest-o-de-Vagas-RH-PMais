import pb from '@/lib/pocketbase/client'
import { RequisitionChangeRequestRecord } from '@/types'

const EXPAND = 'solicitante,decidido_por,requisition'

export const getChangeRequests = async (requisitionId: string) =>
  pb.collection<RequisitionChangeRequestRecord>('requisition_change_requests').getFullList({
    filter: `requisition = "${requisitionId}"`,
    sort: '-created',
    expand: EXPAND,
  })

export const createChangeRequest = async (data: Partial<RequisitionChangeRequestRecord>) =>
  pb.collection<RequisitionChangeRequestRecord>('requisition_change_requests').create(data, {
    expand: EXPAND,
  })

export const decideChangeRequest = async (id: string, status: string, decisaoComentario?: string) =>
  pb.send(`/backend/v1/requisition-change-requests/${id}/decide`, {
    method: 'POST',
    body: JSON.stringify({ status, decisao_comentario: decisaoComentario || '' }),
    headers: { 'Content-Type': 'application/json' },
  })
