import pb from '@/lib/pocketbase/client'
import { TipoVagaRecord } from '@/types'

export const getTiposVaga = async () => {
  return pb.collection<TipoVagaRecord>('tipos_vaga').getFullList({ sort: 'nome' })
}

export const createTipoVaga = async (data: { nome: string }) => {
  return pb.collection<TipoVagaRecord>('tipos_vaga').create(data)
}

export const updateTipoVaga = async (id: string, data: { nome: string }) => {
  return pb.collection<TipoVagaRecord>('tipos_vaga').update(id, data)
}

export const deleteTipoVaga = async (id: string) => {
  return pb.collection<TipoVagaRecord>('tipos_vaga').delete(id)
}
