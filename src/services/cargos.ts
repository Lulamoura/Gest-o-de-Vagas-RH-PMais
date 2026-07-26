import pb from '@/lib/pocketbase/client'
import { CargoRecord } from '@/types'

export const getCargos = async () => {
  return pb.collection<CargoRecord>('cargos').getFullList({ sort: 'nome' })
}

export const createCargo = async (data: { nome: string }) => {
  return pb.collection<CargoRecord>('cargos').create(data)
}

export const updateCargo = async (id: string, data: { nome: string }) => {
  return pb.collection<CargoRecord>('cargos').update(id, data)
}

export const deleteCargo = async (id: string) => {
  return pb.collection<CargoRecord>('cargos').delete(id)
}
