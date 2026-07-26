import { RecordModel } from 'pocketbase'

export type UserProfile = 'admin' | 'operator' | 'viewer'

export interface UserRecord extends RecordModel {
  name: string
  avatar?: string
  profile?: UserProfile
  email: string
}

export type VacancyStatus =
  | 'Aberta'
  | 'Triagem'
  | 'Entrevistas'
  | 'Pré-Aprovação'
  | 'Alocação'
  | 'Fechada'
  | 'Cancelada'

export type VacancyPriority = 'Alta' | 'Média' | 'Baixa'

export interface ClienteRecord extends RecordModel {
  nome: string
}

export interface CargoRecord extends RecordModel {
  nome: string
}

export interface CidadeRecord extends RecordModel {
  nome: string
}

export interface TipoVagaRecord extends RecordModel {
  nome: string
}

export interface VacancyRecord extends RecordModel {
  cliente: string
  cargo: string
  cidade?: string
  quantidade_vagas: number
  tipo_vaga?: string
  data_abertura?: string
  data_fechamento?: string
  data_cancelamento?: string
  prazo_desejado?: string
  responsavel_rh?: string
  responsavel_operacional?: string
  status_vaga: VacancyStatus
  prioridade: VacancyPriority
  salario_faixa?: string
  especificacoes?: string
  observacoes_internas?: string
  expand?: {
    responsavel_rh?: UserRecord
    cliente?: ClienteRecord
    cargo?: CargoRecord
    cidade?: CidadeRecord
    tipo_vaga?: TipoVagaRecord
  }
}

export type CandidateStatus =
  | 'Em análise do gestor'
  | 'Pré-Aprovado'
  | 'Integrado'
  | 'Desistiu'
  | 'Não aprovado'
  | 'Rejeitado'

export interface CandidateRecord extends RecordModel {
  vacancy_id: string
  nome: string
  email?: string
  telefone?: string
  custo_consultas?: number
  custo_exames?: number
  custo_testes?: number
  custo_extras?: number
  rank?: number
  status_candidato: CandidateStatus
  expand?: {
    vacancy_id?: VacancyRecord
  }
}

export interface PipelineHistoryRecord extends RecordModel {
  vacancy_id: string
  usuario_id?: string
  status_anterior?: string
  status_novo?: string
  data_mudanca?: string
  expand?: {
    usuario_id?: UserRecord
    vacancy_id?: VacancyRecord
  }
}
