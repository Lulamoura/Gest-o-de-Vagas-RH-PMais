import pb from '@/lib/pocketbase/client'
import { CandidatoConsultaJuridicaRecord } from '@/types'

export interface CustoConsultasVagaItem {
  vagaId: string
  vagaTitulo: string
  clienteNome: string
  cargoNome: string
  totalCandidatos: number
  custoTotalConsultas: number
}

export const getCandidatoConsultasJuridicas = async (): Promise<
  CandidatoConsultaJuridicaRecord[]
> => {
  return pb
    .collection('candidato_consultas_juridicas')
    .getFullList<CandidatoConsultaJuridicaRecord>({
      sort: '-consultado_em',
      batch: 500,
    })
}
