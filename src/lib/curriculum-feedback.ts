import type { VacancyRecord } from '@/types'
import type {
  CurriculumApplicationSearchResult,
  CurriculumFeedbackInterpretation,
} from '@/services/curriculumFeedback'

export interface CurriculumFeedbackRoles {
  isRH: boolean
  isAdmin: boolean
  isSuperAdmin: boolean
  profile?: string
}

export const isWellFormedUtf16 = (value: unknown): value is string => {
  if (typeof value !== 'string') return false
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index)
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      if (index + 1 >= value.length) return false
      const nextCodeUnit = value.charCodeAt(index + 1)
      if (nextCodeUnit < 0xdc00 || nextCodeUnit > 0xdfff) return false
      index += 1
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false
    }
  }
  return true
}

export const curriculumFeedbackSemanticTextInRange = (
  value: unknown,
  minimum: number,
  maximum: number,
): value is string =>
  isWellFormedUtf16(value) && value.trim().length >= minimum && value.trim().length <= maximum

export const curriculumFeedbackRawTextAtMost = (value: unknown, maximum: number): value is string =>
  isWellFormedUtf16(value) && value.length <= maximum

export const canAccessCurriculumFeedback = ({
  isRH,
  isAdmin,
  isSuperAdmin,
  profile,
}: CurriculumFeedbackRoles): boolean => isAdmin || isSuperAdmin || (isRH && profile === 'operator')

export const filterCurriculumFeedbackVacancies = (vacancies: VacancyRecord[]): VacancyRecord[] =>
  vacancies.filter((vacancy) => !!vacancy.wordpress_job_id?.trim())

export interface CurriculumFeedbackState {
  revision: number
  step: 'capture' | 'review'
  vacancyId: string
  selectedApplication: CurriculumApplicationSearchResult | null
  perception: string
  interpretation: CurriculumFeedbackInterpretation | null
  complement: string
  submitting: boolean
}

export type CurriculumFeedbackAction =
  | { type: 'SELECT_VACANCY'; vacancyId: string }
  | { type: 'SELECT_APPLICATION'; application: CurriculumApplicationSearchResult | null }
  | { type: 'SET_PERCEPTION'; perception: string }
  | {
      type: 'SHOW_REVIEW'
      revision: number
      interpretation: CurriculumFeedbackInterpretation
    }
  | { type: 'SET_COMPLEMENT'; complement: string }
  | { type: 'BACK' }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_FAILURE' }
  | { type: 'RESET' }

export const createInitialCurriculumFeedbackState = (): CurriculumFeedbackState => ({
  revision: 0,
  step: 'capture',
  vacancyId: '',
  selectedApplication: null,
  perception: '',
  interpretation: null,
  complement: '',
  submitting: false,
})

export const curriculumFeedbackReducer = (
  state: CurriculumFeedbackState,
  action: CurriculumFeedbackAction,
): CurriculumFeedbackState => {
  switch (action.type) {
    case 'SELECT_VACANCY':
      return {
        ...createInitialCurriculumFeedbackState(),
        revision: state.revision + 1,
        vacancyId: action.vacancyId,
      }
    case 'SELECT_APPLICATION':
      return {
        ...state,
        revision: state.revision + 1,
        step: 'capture',
        selectedApplication: action.application,
        interpretation: null,
        complement: '',
      }
    case 'SET_PERCEPTION':
      return {
        ...state,
        revision: state.revision + 1,
        step: 'capture',
        perception: action.perception,
        interpretation: null,
        complement: '',
      }
    case 'SHOW_REVIEW':
      if (action.revision !== state.revision) return state
      return { ...state, step: 'review', interpretation: action.interpretation }
    case 'SET_COMPLEMENT':
      return { ...state, complement: action.complement }
    case 'BACK':
      return { ...state, step: 'capture', submitting: false }
    case 'SUBMIT_START':
      return { ...state, submitting: true }
    case 'SUBMIT_FAILURE':
      return { ...state, submitting: false }
    case 'RESET':
      return createInitialCurriculumFeedbackState()
  }
}

export const canRequestCurriculumFeedbackInterpretation = (
  state: CurriculumFeedbackState,
): boolean =>
  !!state.vacancyId &&
  !!state.selectedApplication &&
  curriculumFeedbackSemanticTextInRange(state.perception, 3, 4000)

export const canConfirmCurriculumFeedback = (state: CurriculumFeedbackState): boolean =>
  state.step === 'review' &&
  !!state.vacancyId &&
  !!state.selectedApplication &&
  !!state.interpretation?.feedback_proof.signature &&
  curriculumFeedbackSemanticTextInRange(state.perception, 3, 4000) &&
  curriculumFeedbackSemanticTextInRange(state.interpretation?.understanding, 1, 4000) &&
  curriculumFeedbackSemanticTextInRange(state.interpretation?.justification, 1, 4000) &&
  curriculumFeedbackRawTextAtMost(state.complement, 4000) &&
  !state.submitting
