import pb from '@/lib/pocketbase/client'
import { ClienteRecord } from '@/types'

export const getClientes = async () => {
  return pb.collection<ClienteRecord>('clientes').getFullList({ sort: 'nome' })
}

export const createCliente = async (data: { nome: string }) => {
  return pb.collection<ClienteRecord>('clientes').create(data)
}

export const updateCliente = async (id: string, data: { nome: string }) => {
  return pb.collection<ClienteRecord>('clientes').update(id, data)
}

export const deleteCliente = async (id: string) => {
  return pb.collection<ClienteRecord>('clientes').delete(id)
}
