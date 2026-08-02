import pb from '@/lib/pocketbase/client'
import { DepartamentoRecord } from '@/types'

export const getDepartamentos = async () =>
  pb.collection<DepartamentoRecord>('departamentos').getFullList({ sort: 'nome' })

export const createDepartamento = async (data: { nome: string }) =>
  pb.collection<DepartamentoRecord>('departamentos').create(data)

export const updateDepartamento = async (id: string, data: { nome: string }) =>
  pb.collection<DepartamentoRecord>('departamentos').update(id, data)

export const deleteDepartamento = async (id: string) =>
  pb.collection<DepartamentoRecord>('departamentos').delete(id)
