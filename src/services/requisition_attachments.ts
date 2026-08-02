import pb from '@/lib/pocketbase/client'
import { RequisitionAttachmentRecord } from '@/types'

const EXPAND = 'uploaded_by'

export const getRequisitionAttachments = async (requisitionId: string) =>
  pb.collection<RequisitionAttachmentRecord>('requisition_attachments').getFullList({
    filter: `requisition_id = "${requisitionId}"`,
    sort: '-created',
    expand: EXPAND,
  })

export const createRequisitionAttachment = async (
  requisitionId: string,
  file: File,
  userId: string,
) => {
  const formData = new FormData()
  formData.append('requisition_id', requisitionId)
  formData.append('uploaded_by', userId)
  formData.append('arquivo', file)
  formData.append('nome_arquivo', file.name)
  return pb.collection<RequisitionAttachmentRecord>('requisition_attachments').create(formData)
}

export const deleteRequisitionAttachment = async (id: string) =>
  pb.collection<RequisitionAttachmentRecord>('requisition_attachments').delete(id)
