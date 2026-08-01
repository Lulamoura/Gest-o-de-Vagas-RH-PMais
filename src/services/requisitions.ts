import pb from '@/lib/pocketbase/client'
import { RequisitionRecord } from '@/types'

const EXPAND = 'solicitante,cliente,cargo,cidade,tipo_vaga,tipo_contrato'

export const getRequisitions = async () => {
  return pb.collection<RequisitionRecord>('requisitions').getFullList({
    sort: '-created',
    expand: EXPAND,
  })
}

export const getRequisition = async (id: string) => {
  return pb.collection<RequisitionRecord>('requisitions').getOne(id, {
    expand: EXPAND,
  })
}

export const createRequisition = async (data: Partial<RequisitionRecord>) => {
  return pb.collection<RequisitionRecord>('requisitions').create(data)
}

export const updateRequisition = async (id: string, data: Partial<RequisitionRecord>) => {
  return pb.collection<RequisitionRecord>('requisitions').update(id, data)
}

export const deleteRequisition = async (id: string) => {
  return pb.collection<RequisitionRecord>('requisitions').delete(id)
}
