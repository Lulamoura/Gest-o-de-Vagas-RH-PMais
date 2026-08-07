import { RecordModel } from 'pocketbase'

export type UserProfile = 'admin' | 'operator' | 'viewer' | 'superadmin'

export interface UserRecord extends RecordModel {
  name: string
  avatar?: string
  profile?: UserProfile
  email: string
  departamento?: string
  expand?: {
    departamento?: DepartamentoRecord
  }
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

export interface ClinicaRecord extends RecordModel {
  nome: string
  endereco?: string
  telefone?: string
  email?: string
  pessoa_contato?: string
}

export interface BaseIntegracaoRecord extends RecordModel {
  nome: string
  endereco?: string
  telefone?: string
  email?: string
  pessoa_contato?: string
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
  ordem_execucao?: string
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
  informacoes_integracao?: string
  status_candidato: CandidateStatus
  integracao_ativa?: boolean
  data_integracao?: string
  hora_integracao?: string
  tipo_integracao?: 'Presencial' | 'On-line'
  valor_unitario_transporte?: number
  data_nascimento?: string
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

export interface SystemParameterRecord extends RecordModel {
  prazo_alerta_dias: number
  nome_remetente?: string
  email_remetente?: string
  slogan_pmais?: string
  email_dp?: string
  email_operacional?: string
  email_dp_lista?: string
  email_operacional_lista?: string
  email_comercial?: string
}

export type EmailType =
  | 'complement_data'
  | 'disqualification'
  | 'encaminhamento_exames'
  | 'aviso_integracao'
  | 'aviso_integracao_candidato'

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

export type RequisitionStatus =
  | 'Rascunho'
  | 'Aguardando aprovação'
  | 'Em análise'
  | 'Aprovada'
  | 'Reprovada'
  | 'Cancelada'
  | 'Rascunho criado no WordPress'
  | 'Publicada'

export interface DepartamentoRecord extends RecordModel {
  nome: string
}

export interface RequisitionHistoryRecord extends RecordModel {
  requisition_id: string
  usuario_id?: string
  status_anterior?: string
  status_novo: string
  acao?: string
  observacao?: string
  data_mudanca?: string
  expand?: {
    usuario_id?: UserRecord
  }
}

export interface RequisitionCommentRecord extends RecordModel {
  requisition_id: string
  usuario_id: string
  comentario: string
  expand?: {
    usuario_id?: UserRecord
  }
}

export interface RequisitionAttachmentRecord extends RecordModel {
  requisition_id: string
  uploaded_by: string
  arquivo: string
  nome_arquivo?: string
  expand?: {
    uploaded_by?: UserRecord
  }
}

export type RequisitionDepartamento = 'comercial' | 'operacional' | 'rh'

export interface NotificationRecord extends RecordModel {
  user: string
  requisition: string
  type: string
  message: string
  read: boolean
  expand?: {
    user?: UserRecord
    requisition?: RequisitionRecord
  }
}

export interface RequisitionChangeRequestRecord extends RecordModel {
  requisition: string
  solicitante: string
  campos_alterados: string
  valores_propostos: string
  justificativa: string
  status: 'Pendente' | 'Aprovada' | 'Reprovada'
  decisao_comentario?: string
  decidido_por?: string
  decidido_em?: string
  expand?: {
    solicitante?: UserRecord
    decidido_por?: UserRecord
    requisition?: RequisitionRecord
  }
}

export interface RequisitionRecord extends RecordModel {
  solicitante: string
  numero_oe?: string
  departamento?: string
  cliente?: string
  cargo?: string
  cidade?: string
  tipo_vaga?: string
  tipo_contrato?: string
  quantidade_vagas?: number
  prazo_desejado?: string
  prioridade?: VacancyPriority
  faixa_salarial?: string
  justificativa: string
  especificacoes?: string
  observacoes_internas?: string
  jornada?: string
  horario?: string
  escala?: string
  remuneracao?: string
  beneficios?: string
  requisitos?: string
  escolaridade?: string
  experiencia?: string
  wordpress_job_id?: string
  wordpress_admin_url?: string
  wordpress_sync_status?: 'pendente' | 'sucesso' | 'erro'
  wordpress_sync_date?: string
  wordpress_error_message?: string
  edicao_liberada?: boolean
  link_publico?: string
  data_publicacao?: string
  status: RequisitionStatus
  expand?: {
    solicitante?: UserRecord
    cliente?: ClienteRecord
    cargo?: CargoRecord
    cidade?: CidadeRecord
    tipo_vaga?: TipoVagaRecord
    tipo_contrato?: TipoContratoRecord
    departamento?: DepartamentoRecord
  }
}
