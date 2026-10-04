import { irisBrowserAdapterRequest } from '@/services/requisitions'
import {
  curriculumFeedbackRawTextAtMost,
  curriculumFeedbackSemanticTextInRange,
  isWellFormedUtf16,
} from '@/lib/curriculum-feedback'

const CURRICULUM_FEEDBACK_PATH = '/v1/pessoas/iris/gv-rh/browser/vacancies'

const vacancyFeedbackPath = (vacancyId: string) =>
  `${CURRICULUM_FEEDBACK_PATH}/${encodeURIComponent(vacancyId)}/curriculum-feedback`

export interface CurriculumApplicationSearchResult {
  application_id: string
  name: string
  applied_at: string
  masked_email: string
}

interface CurriculumApplicationSearchResponse {
  ok: true
  vacancy_id: string
  items: CurriculumApplicationSearchResult[]
}

export interface CurriculumFeedbackProof {
  expires_at: number
  signature: string
}

export interface InterpretCurriculumFeedbackInput {
  vacancy_id: string
  application_id: string
  perception: string
}

export interface CurriculumFeedbackInterpretation {
  ok: true
  operation: 'interpret_curriculum_feedback'
  agent: 'iris'
  fallback: false
  understanding: string
  justification: string
  feedback_proof: CurriculumFeedbackProof
}

export interface ConfirmCurriculumFeedbackInput {
  vacancy_id: string
  application_id: string
  perception: string
  understanding: string
  justification: string
  complement: string
  feedback_proof: CurriculumFeedbackProof
}

export interface CurriculumFeedbackConfirmation {
  ok: true
  verified: true
  duplicate: boolean
  feedback_id: string
  calibration_state: 'pending_review'
}

const validatePerception = (perception: string) => {
  if (!isWellFormedUtf16(perception)) {
    throw new Error('A percepção do RH contém texto Unicode inválido.')
  }
  const normalizedPerception = perception.trim()
  if (!normalizedPerception) throw new Error('A percepção do RH é obrigatória.')
  if (normalizedPerception.length < 3) {
    throw new Error('A percepção do RH deve ter ao menos 3 caracteres.')
  }
  if (normalizedPerception.length > 4000) {
    throw new Error('A percepção do RH deve ter no máximo 4000 caracteres.')
  }
}

export const searchCurriculumApplications = async (
  vacancyId: string,
  query: string,
): Promise<CurriculumApplicationSearchResult[]> => {
  const normalizedQuery = query.trim()
  if (normalizedQuery.length < 2) return []

  const response = await irisBrowserAdapterRequest<CurriculumApplicationSearchResponse>(
    `${vacancyFeedbackPath(vacancyId)}/applications/search`,
    { name: normalizedQuery },
  )
  if (
    response?.ok !== true ||
    response?.vacancy_id !== vacancyId ||
    !Array.isArray(response?.items)
  ) {
    throw new Error('Não foi possível validar as candidaturas encontradas.')
  }
  return response.items
}

export const interpretCurriculumFeedback = async (
  input: InterpretCurriculumFeedbackInput,
): Promise<CurriculumFeedbackInterpretation> => {
  validatePerception(input.perception)
  const response = await irisBrowserAdapterRequest<CurriculumFeedbackInterpretation>(
    `${vacancyFeedbackPath(input.vacancy_id)}/interpret`,
    {
      application_id: input.application_id,
      perception: input.perception,
    },
  )
  if (
    response?.ok !== true ||
    response?.operation !== 'interpret_curriculum_feedback' ||
    response?.agent !== 'iris' ||
    response?.fallback !== false ||
    !curriculumFeedbackSemanticTextInRange(response?.understanding, 1, 4000) ||
    !curriculumFeedbackSemanticTextInRange(response?.justification, 1, 4000) ||
    typeof response?.feedback_proof?.expires_at !== 'number' ||
    typeof response?.feedback_proof?.signature !== 'string' ||
    !/^[a-f0-9]{64}$/.test(response.feedback_proof.signature)
  ) {
    throw new Error('Não foi possível validar o entendimento da Íris.')
  }
  return response
}

export const confirmCurriculumFeedback = async (
  input: ConfirmCurriculumFeedbackInput,
): Promise<CurriculumFeedbackConfirmation> => {
  validatePerception(input.perception)
  if (
    !curriculumFeedbackSemanticTextInRange(input.understanding, 1, 4000) ||
    !curriculumFeedbackSemanticTextInRange(input.justification, 1, 4000)
  ) {
    throw new Error('Não foi possível validar o entendimento da Íris.')
  }
  if (!curriculumFeedbackRawTextAtMost(input.complement, 4000)) {
    throw new Error('O complemento deve ter no máximo 4000 caracteres.')
  }
  const complement = input.complement.trim() ? input.complement : ''
  const response = await irisBrowserAdapterRequest<CurriculumFeedbackConfirmation>(
    `${vacancyFeedbackPath(input.vacancy_id)}/confirm`,
    {
      application_id: input.application_id,
      perception: input.perception,
      understanding: input.understanding,
      justification: input.justification,
      confirmation: complement ? 'complemented' : 'confirmed',
      complement,
      feedback_proof: input.feedback_proof,
    },
  )
  if (
    response?.ok !== true ||
    response?.verified !== true ||
    response?.calibration_state !== 'pending_review' ||
    typeof response?.duplicate !== 'boolean' ||
    typeof response?.feedback_id !== 'string' ||
    !response.feedback_id
  ) {
    throw new Error('Não foi possível verificar a persistência do feedback.')
  }
  return response
}
