export interface CandidateRequiredFields {
  nome?: string
  email?: string
  telefone?: string
  cpf?: string
  cidade?: string
  bairro?: string
  vacancy_id?: string
}

export function isCandidateStatusEnabled(fields: CandidateRequiredFields): boolean {
  return !!(
    fields.nome?.trim() &&
    fields.email?.trim() &&
    fields.telefone?.trim() &&
    fields.cpf?.trim() &&
    fields.cidade?.trim() &&
    fields.bairro?.trim() &&
    fields.vacancy_id?.trim()
  )
}
