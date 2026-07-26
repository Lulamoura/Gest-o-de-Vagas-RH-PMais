import pb from '@/lib/pocketbase/client'
import { CidadeRecord } from '@/types'

export const getCidades = async () => {
  return pb.collection<CidadeRecord>('cidades').getFullList({ sort: 'nome' })
}

export const createCidade = async (data: { nome: string }) => {
  return pb.collection<CidadeRecord>('cidades').create(data)
}

export const updateCidade = async (id: string, data: { nome: string }) => {
  return pb.collection<CidadeRecord>('cidades').update(id, data)
}

export const deleteCidade = async (id: string) => {
  return pb.collection<CidadeRecord>('cidades').delete(id)
}
