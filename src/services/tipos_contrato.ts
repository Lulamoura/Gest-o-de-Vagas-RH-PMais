import pb from '@/lib/pocketbase/client'
import { TipoContratoRecord } from '@/types'

export const getTiposContrato = async () => {
  return pb.collection<TipoContratoRecord>('tipos_contrato').getFullList({ sort: 'nome' })
}

export const createTipoContrato = async (data: { nome: string }) => {
  return pb.collection<TipoContratoRecord>('tipos_contrato').create(data)
}

export const updateTipoContrato = async (id: string, data: { nome: string }) => {
  return pb.collection<TipoContratoRecord>('tipos_contrato').update(id, data)
}

export const deleteTipoContrato = async (id: string) => {
  return pb.collection<TipoContratoRecord>('tipos_contrato').delete(id)
}
