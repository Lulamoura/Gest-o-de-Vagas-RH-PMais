import { RecordModel } from 'pocketbase'

export type UserProfile = 'admin' | 'operator' | 'viewer' | 'superadmin'

export interface UserRecord extends RecordModel {
  name: string
  avatar?: string
  profile?: UserProfile
  email: string
}

export type VacancyStatus = 'Aberta' | 'Concluída' | 'Cancelada'

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

export interface TipoContratoRecord extends RecordModel {
  nome: string
}

export interface VacancyRecord extends RecordModel {
  wordpress_job_id?: string
  cliente: string
  cargo: string
  cidade?: string
  quantidade_vagas: number
  tipo_vaga?: string
  tipo_contrato?: string
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
  despesas_vaga?: number
  expand?: {
    responsavel_rh?: UserRecord
    cliente?: ClienteRecord
    cargo?: CargoRecord
    cidade?: CidadeRecord
    tipo_vaga?: TipoVagaRecord
    tipo_contrato?: TipoContratoRecord
  }
}

export type CandidateStatus =
  | 'Análise do RH'
  | 'Análise do gestor'
  | 'Documentação e exame'
  | 'Cadastro DP'
  | 'Integrado'
  | 'Desistente'
  | 'Desclassificado'
  | 'Em banco'

export interface CandidateRecord extends RecordModel {
  vacancy_id: string
  nome: string
  email?: string
  telefone?: string
  cidade?: string
  bairro?: string
  cpf?: string
  custo_consultas?: number
  custo_exames?: number
  custo_testes?: number
  custo_extras?: number
  rank?: number
  rg?: string
  tamanho_fardamento?: string
  tamanho_sapato?: string
  vale_transporte_qtd?: number
  nome_pai?: string
  nome_mae?: string
  telefone_emergencia?: string
  observacao?: string
  ordem_execucao?: string
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

export interface CandidateHistoryRecord extends RecordModel {
  vacancy_id: string
  candidate_id: string
  usuario_id?: string
  status_anterior?: string
  status_novo: string
  data_mudanca?: string
  expand?: {
    candidate_id?: CandidateRecord
    usuario_id?: UserRecord
  }
}

export interface CandidatoConsultaJuridicaRecord extends RecordModel {
  candidato_id: string
  cpf_consultado?: string
  nome_consultado?: string
  provider?: string
  status_consulta: 'sucesso' | 'erro' | 'sem_resultados'
  total_processos?: number
  total_processos_ativos?: number
  total_processos_inativos?: number
  resumo_json?: Record<string, any>
  estatisticas_json?: Record<string, any> | null
  processos_json?: any[]
  consultado_por?: string
  consultado_em?: string
  erro?: string
  expand?: {
    candidato_id?: CandidateRecord
    consultado_por?: UserRecord
  }
}

export type EmailType = 'complement_data' | 'disqualification'

export interface EmailTemplateRecord extends RecordModel {
  type: EmailType
  subject: string
  body: string
}

export interface CandidateEmailLogRecord extends RecordModel {
  candidate_id: string
  email_type: EmailType
  sent_by?: string
  error_message?: string
  expand?: {
    candidate_id?: CandidateRecord
    sent_by?: UserRecord
  }
}

export type WordpressImportStatus = 'sucesso' | 'duplicada' | 'erro'

export interface WordpressImportLogRecord extends RecordModel {
  wordpress_job_id: string
  origem: string
  status: WordpressImportStatus
  mensagem?: string
  data_hora?: string
}

export interface CustosConsultasRecord extends RecordModel {
  consulta_juridica: number
  resumo_ia: number
  capa_processo: number
}
