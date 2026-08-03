import pb from '@/lib/pocketbase/client'
import { BaseIntegracaoRecord } from '@/types'

export const getBaseIntegracao = async () => {
  return pb.collection<BaseIntegracaoRecord>('base_integracao').getFullList({ sort: 'nome' })
}

export const createBaseIntegracao = async (data: {
  nome: string
  endereco?: string
  telefone?: string
  email?: string
  pessoa_contato?: string
}) => {
  return pb.collection<BaseIntegracaoRecord>('base_integracao').create(data)
}

export const updateBaseIntegracao = async (
  id: string,
  data: {
    nome: string
    endereco?: string
    telefone?: string
    email?: string
    pessoa_contato?: string
  },
) => {
  return pb.collection<BaseIntegracaoRecord>('base_integracao').update(id, data)
}

export const deleteBaseIntegracao = async (id: string) => {
  return pb.collection<BaseIntegracaoRecord>('base_integracao').delete(id)
}
