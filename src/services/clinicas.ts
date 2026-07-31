import pb from '@/lib/pocketbase/client'
import { ClinicaRecord } from '@/types'

export const getClinicas = async () => {
  return pb.collection<ClinicaRecord>('clinicas').getFullList({ sort: 'nome' })
}

export const createClinica = async (data: {
  nome: string
  endereco?: string
  telefone?: string
  email?: string
  pessoa_contato?: string
}) => {
  return pb.collection<ClinicaRecord>('clinicas').create(data)
}

export const updateClinica = async (
  id: string,
  data: {
    nome: string
    endereco?: string
    telefone?: string
    email?: string
    pessoa_contato?: string
  },
) => {
  return pb.collection<ClinicaRecord>('clinicas').update(id, data)
}

export const deleteClinica = async (id: string) => {
  return pb.collection<ClinicaRecord>('clinicas').delete(id)
}
