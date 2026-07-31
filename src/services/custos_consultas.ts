import pb from '@/lib/pocketbase/client'
import { CustosConsultasRecord } from '@/types'

export const getCustosConsultas = async (): Promise<CustosConsultasRecord | null> => {
  try {
    const records = await pb
      .collection('custos_consultas')
      .getFullList<CustosConsultasRecord>({ sort: 'created' })
    return records[0] || null
  } catch {
    return null
  }
}

export const updateCustosConsultas = async (
  id: string,
  data: Partial<Pick<CustosConsultasRecord, 'consulta_juridica' | 'resumo_ia' | 'capa_processo'>>,
) => {
  return pb.collection<CustosConsultasRecord>('custos_consultas').update(id, data)
}

export const createCustosConsultas = async (data: {
  consulta_juridica: number
  resumo_ia: number
  capa_processo: number
}) => {
  return pb.collection<CustosConsultasRecord>('custos_consultas').create(data)
}
