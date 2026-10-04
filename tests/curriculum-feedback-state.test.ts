import { describe, expect, it } from 'vitest'

import {
  canAccessCurriculumFeedback,
  canConfirmCurriculumFeedback,
  canRequestCurriculumFeedbackInterpretation,
  createInitialCurriculumFeedbackState,
  curriculumFeedbackReducer,
  filterCurriculumFeedbackVacancies,
} from '@/lib/curriculum-feedback'
import type { VacancyRecord } from '@/types'

const illFormedUtf16 = ['\ud83d', '\ude00', '\ud83dA\ude00']

describe('curriculum feedback permission', () => {
  it.each([
    [{ isRH: true, isAdmin: false, isSuperAdmin: false, profile: 'operator' }, true],
    [{ isRH: true, isAdmin: false, isSuperAdmin: false, profile: 'viewer' }, false],
    [{ isRH: false, isAdmin: true, isSuperAdmin: false, profile: 'admin' }, true],
    [{ isRH: false, isAdmin: false, isSuperAdmin: true, profile: 'superadmin' }, true],
    [{ isRH: false, isAdmin: false, isSuperAdmin: false, profile: 'operator' }, false],
  ])('allows only RH, admin or superadmin for %o', (roles, expected) => {
    expect(canAccessCurriculumFeedback(roles)).toBe(expected)
  })
})

describe('curriculum feedback vacancies', () => {
  it('offers only GV vacancies that are bound to a WordPress job', () => {
    const withWordPress = { id: 'vacancy-1', wordpress_job_id: '123' } as VacancyRecord
    const blankWordPress = { id: 'vacancy-2', wordpress_job_id: '   ' } as VacancyRecord
    const withoutWordPress = { id: 'vacancy-3' } as VacancyRecord

    expect(
      filterCurriculumFeedbackVacancies([withoutWordPress, blankWordPress, withWordPress]),
    ).toEqual([withWordPress])
  })
})

describe('curriculum feedback state', () => {
  const application = {
    application_id: 'application-9',
    name: 'Ana Silva',
    applied_at: '2026-10-01',
    masked_email: 'a***@example.com',
  }

  it('moves from capture to read-only Íris review and back without losing the RH input', () => {
    let state = createInitialCurriculumFeedbackState()
    state = curriculumFeedbackReducer(state, { type: 'SELECT_VACANCY', vacancyId: 'vacancy-1' })
    state = curriculumFeedbackReducer(state, { type: 'SELECT_APPLICATION', application })
    state = curriculumFeedbackReducer(state, {
      type: 'SET_PERCEPTION',
      perception: 'Experiência aderente não considerada.',
    })
    state = curriculumFeedbackReducer(state, {
      type: 'SHOW_REVIEW',
      revision: state.revision,
      interpretation: {
        ok: true,
        operation: 'interpret_curriculum_feedback',
        agent: 'iris',
        fallback: false,
        understanding: 'O RH diverge da análise.',
        justification: 'Há evidência no currículo.',
        feedback_proof: { expires_at: 1791120000, signature: 'a'.repeat(64) },
      },
    })

    expect(state.step).toBe('review')
    expect(state.interpretation?.understanding).toBe('O RH diverge da análise.')

    state = curriculumFeedbackReducer(state, { type: 'BACK' })
    expect(state.step).toBe('capture')
    expect(state.perception).toBe('Experiência aderente não considerada.')
    expect(state.selectedApplication).toEqual(application)
  })

  it.each([
    ['vacancy', { type: 'SELECT_VACANCY', vacancyId: 'vacancy-2' }],
    ['application', { type: 'SELECT_APPLICATION', application: null }],
    ['perception', { type: 'SET_PERCEPTION', perception: 'Percepção alterada.' }],
  ] as const)(
    'ignores an in-flight interpretation after the %s changes',
    (_label, changeAction) => {
      let state = createInitialCurriculumFeedbackState()
      state = curriculumFeedbackReducer(state, {
        type: 'SELECT_VACANCY',
        vacancyId: 'vacancy-1',
      })
      state = curriculumFeedbackReducer(state, { type: 'SELECT_APPLICATION', application })
      state = curriculumFeedbackReducer(state, {
        type: 'SET_PERCEPTION',
        perception: 'Percepção original.',
      })
      const requestRevision = (state as typeof state & { revision?: number }).revision
      state = curriculumFeedbackReducer(state, changeAction)
      state = curriculumFeedbackReducer(
        state,
        {
          type: 'SHOW_REVIEW',
          revision: requestRevision,
          interpretation: {
            ok: true,
            operation: 'interpret_curriculum_feedback',
            agent: 'iris',
            fallback: false,
            understanding: 'Entendimento obsoleto.',
            justification: 'Justificativa obsoleta.',
            feedback_proof: { expires_at: 1791120000, signature: 'a'.repeat(64) },
          },
        } as Parameters<typeof curriculumFeedbackReducer>[1],
      )

      expect(state.step).toBe('capture')
      expect(state.interpretation).toBeNull()
    },
  )

  it('requires vacancy, application and a perception between 3 and 4000 characters', () => {
    let state = createInitialCurriculumFeedbackState()
    expect(canRequestCurriculumFeedbackInterpretation(state)).toBe(false)

    state = curriculumFeedbackReducer(state, { type: 'SELECT_VACANCY', vacancyId: 'vacancy-1' })
    state = curriculumFeedbackReducer(state, { type: 'SELECT_APPLICATION', application })
    state = curriculumFeedbackReducer(state, {
      type: 'SET_PERCEPTION',
      perception: 'ab',
    })
    expect(canRequestCurriculumFeedbackInterpretation(state)).toBe(false)

    state = curriculumFeedbackReducer(state, {
      type: 'SET_PERCEPTION',
      perception: 'abc',
    })
    expect(canRequestCurriculumFeedbackInterpretation(state)).toBe(true)

    state = curriculumFeedbackReducer(state, {
      type: 'SET_PERCEPTION',
      perception: 'x'.repeat(4000),
    })
    expect(canRequestCurriculumFeedbackInterpretation(state)).toBe(true)

    state = curriculumFeedbackReducer(state, {
      type: 'SET_PERCEPTION',
      perception: 'x'.repeat(4001),
    })
    expect(canRequestCurriculumFeedbackInterpretation(state)).toBe(false)
  })

  it.each([
    ['whitespace-only text', '   \n\t', false],
    ['padded two-unit content', '  ab  ', false],
    ['one astral emoji (two UTF-16 units)', '😀', false],
    ['two astral emoji (four UTF-16 units)', '😀😀', true],
    ['4000 trimmed UTF-16 units with preserved padding', `  ${'😀'.repeat(2000)}  `, true],
    ['4002 trimmed UTF-16 units', '😀'.repeat(2001), false],
  ])('uses trimmed UTF-16 semantic bounds for perception: %s', (_label, perception, expected) => {
    const state = {
      ...createInitialCurriculumFeedbackState(),
      vacancyId: 'vacancy-1',
      selectedApplication: application,
      perception,
    }

    expect(canRequestCurriculumFeedbackInterpretation(state)).toBe(expected)
  })

  it.each(illFormedUtf16)('rejects ill-formed UTF-16 perception before range validation', (perception) => {
    const state = {
      ...createInitialCurriculumFeedbackState(),
      vacancyId: 'vacancy-1',
      selectedApplication: application,
      perception: `abc${perception}`,
    }

    expect(canRequestCurriculumFeedbackInterpretation(state)).toBe(false)
  })

  it('accepts a well-formed astral pair without changing UTF-16 length semantics', () => {
    const state = {
      ...createInitialCurriculumFeedbackState(),
      vacancyId: 'vacancy-1',
      selectedApplication: application,
      perception: 'a😀',
    }

    expect(canRequestCurriculumFeedbackInterpretation(state)).toBe(true)
  })

  it('requires valid trimmed interpretation text while bounding the raw optional complement', () => {
    const baseState = {
      ...createInitialCurriculumFeedbackState(),
      step: 'review' as const,
      vacancyId: 'vacancy-1',
      selectedApplication: application,
      perception: 'Percepção válida.',
      interpretation: {
        ok: true as const,
        operation: 'interpret_curriculum_feedback' as const,
        agent: 'iris' as const,
        fallback: false as const,
        understanding: 'Entendimento',
        justification: 'Justificativa',
        feedback_proof: { expires_at: 1791120000, signature: 'a'.repeat(64) },
      },
    }

    expect(
      canConfirmCurriculumFeedback({
        ...baseState,
        interpretation: { ...baseState.interpretation, understanding: ' \n ' },
      }),
    ).toBe(false)
    expect(
      canConfirmCurriculumFeedback({
        ...baseState,
        interpretation: { ...baseState.interpretation, justification: ` ${'😀'.repeat(2001)} ` },
      }),
    ).toBe(false)
    expect(canConfirmCurriculumFeedback({ ...baseState, complement: ' '.repeat(4001) })).toBe(false)
    expect(canConfirmCurriculumFeedback({ ...baseState, complement: ' \n\t ' })).toBe(true)
  })

  it.each(['perception', 'understanding', 'justification', 'complement'] as const)(
    'rejects ill-formed UTF-16 in %s before enabling confirmation',
    (field) => {
      const baseState = {
        ...createInitialCurriculumFeedbackState(),
        step: 'review' as const,
        vacancyId: 'vacancy-1',
        selectedApplication: application,
        perception: 'Percepção válida.',
        complement: '',
        interpretation: {
          ok: true as const,
          operation: 'interpret_curriculum_feedback' as const,
          agent: 'iris' as const,
          fallback: false as const,
          understanding: 'Entendimento',
          justification: 'Justificativa',
          feedback_proof: { expires_at: 1791120000, signature: 'a'.repeat(64) },
        },
      }
      const state =
        field === 'perception' || field === 'complement'
          ? { ...baseState, [field]: `texto\ud83d` }
          : {
              ...baseState,
              interpretation: { ...baseState.interpretation, [field]: `texto\ud83d` },
            }

      expect(canConfirmCurriculumFeedback(state)).toBe(false)
    },
  )

  it('prevents a second confirmation while the first one is running', () => {
    let state = createInitialCurriculumFeedbackState()
    state = curriculumFeedbackReducer(state, { type: 'SELECT_VACANCY', vacancyId: 'vacancy-1' })
    state = curriculumFeedbackReducer(state, { type: 'SELECT_APPLICATION', application })
    state = curriculumFeedbackReducer(state, {
      type: 'SET_PERCEPTION',
      perception: 'Experiência aderente.',
    })
    state = curriculumFeedbackReducer(state, {
      type: 'SHOW_REVIEW',
      revision: state.revision,
      interpretation: {
        ok: true,
        operation: 'interpret_curriculum_feedback',
        agent: 'iris',
        fallback: false,
        understanding: 'Entendimento',
        justification: 'Justificativa',
        feedback_proof: { expires_at: 1791120000, signature: 'a'.repeat(64) },
      },
    })
    state = curriculumFeedbackReducer(state, {
      type: 'SET_COMPLEMENT',
      complement: 'x'.repeat(4000),
    })
    expect(canConfirmCurriculumFeedback(state)).toBe(true)

    state = curriculumFeedbackReducer(state, { type: 'SUBMIT_START' })
    expect(canConfirmCurriculumFeedback(state)).toBe(false)
  })

  it('clears all state after cancel or a verified success', () => {
    let state = {
      ...createInitialCurriculumFeedbackState(),
      vacancyId: 'vacancy-1',
      selectedApplication: application,
      perception: 'Percepção',
      complement: 'Complemento',
      submitting: true,
    }

    state = curriculumFeedbackReducer(state, { type: 'RESET' })
    expect(state).toEqual(createInitialCurriculumFeedbackState())
  })

  it('clears the bound application and text when the vacancy changes', () => {
    const state = curriculumFeedbackReducer(
      {
        ...createInitialCurriculumFeedbackState(),
        vacancyId: 'vacancy-1',
        selectedApplication: application,
        perception: 'Percepção anterior',
      },
      { type: 'SELECT_VACANCY', vacancyId: 'vacancy-2' },
    )

    expect(state).toEqual({
      ...createInitialCurriculumFeedbackState(),
      revision: 1,
      vacancyId: 'vacancy-2',
    })
  })
})
