import pb from '@/lib/pocketbase/client'
import type { SystemParameterRecord } from '@/types'

export const getSystemParameters = async (): Promise<SystemParameterRecord | null> => {
  const records = await pb.collection('system_parameters').getFullList<SystemParameterRecord>({
    sort: 'created',
  })
  return records[0] || null
}

export const createSystemParameters = (data: {
  prazo_alerta_dias: number
  nome_remetente?: string
  email_remetente?: string
}) => pb.collection('system_parameters').create<SystemParameterRecord>(data)

export const updateSystemParameters = (
  id: string,
  data: Partial<{
    prazo_alerta_dias: number
    nome_remetente: string
    email_remetente: string
  }>,
) => pb.collection('system_parameters').update<SystemParameterRecord>(id, data)

export const deleteSystemParameters = (id: string) => pb.collection('system_parameters').delete(id)
