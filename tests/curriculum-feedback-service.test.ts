import { beforeEach, describe, expect, it, vi } from 'vitest'

const { irisBrowserAdapterRequest } = vi.hoisted(() => ({
  irisBrowserAdapterRequest: vi.fn(),
}))

vi.mock('@/services/requisitions', () => ({
  irisBrowserAdapterRequest,
}))

import {
  confirmCurriculumFeedback,
  interpretCurriculumFeedback,
  searchCurriculumApplications,
} from '@/services/curriculumFeedback'

describe('curriculum feedback service', () => {
  beforeEach(() => {
    irisBrowserAdapterRequest.mockReset()
  })

  it('does not call the Gateway before the candidate query has two characters', async () => {
    await expect(searchCurriculumApplications('vacancy-1', ' A ')).resolves.toEqual([])
    expect(irisBrowserAdapterRequest).not.toHaveBeenCalled()
  })

  it('searches protected WordPress applications through the browser adapter using the GV vacancy id', async () => {
    const response = {
      ok: true,
      vacancy_id: 'vacancy-1',
      items: [
        {
          application_id: '9001',
          name: 'Ana Silva',
          applied_at: '2026-10-01',
          masked_email: 'a***@example.com',
        },
      ],
    }
    irisBrowserAdapterRequest.mockResolvedValue(response)

    await expect(searchCurriculumApplications('vacancy-1', ' Ana ')).resolves.toEqual(
      response.items,
    )
    expect(irisBrowserAdapterRequest).toHaveBeenCalledWith(
      '/v1/pessoas/iris/gv-rh/browser/vacancies/vacancy-1/curriculum-feedback/applications/search',
      { name: 'Ana' },
    )
  })

  it('rejects application search results bound to another vacancy', async () => {
    irisBrowserAdapterRequest.mockResolvedValue({
      ok: true,
      vacancy_id: 'vacancy-2',
      items: [],
    })

    await expect(searchCurriculumApplications('vacancy-1', 'Ana')).rejects.toThrow(
      'Não foi possível validar as candidaturas encontradas.',
    )
  })

  it('asks Íris to interpret the exact RH perception for the selected application', async () => {
    const response = {
      ok: true,
      operation: 'interpret_curriculum_feedback',
      agent: 'iris',
      fallback: false,
      understanding: 'O RH identificou experiência relevante não considerada.',
      justification: 'A experiência aparece no histórico profissional da candidatura.',
      feedback_proof: { expires_at: 1791120000, signature: 'a'.repeat(64) },
    }
    irisBrowserAdapterRequest.mockResolvedValue(response)

    await expect(
      interpretCurriculumFeedback({
        vacancy_id: 'vacancy-1',
        application_id: '9001',
        perception: '  Há experiência aderente no currículo.  ',
      }),
    ).resolves.toEqual(response)
    expect(irisBrowserAdapterRequest).toHaveBeenCalledWith(
      '/v1/pessoas/iris/gv-rh/browser/vacancies/vacancy-1/curriculum-feedback/interpret',
      {
        application_id: '9001',
        perception: '  Há experiência aderente no currículo.  ',
      },
    )
  })

  it('rejects blank, shorter than three characters, or oversized RH perceptions before calling the Gateway', async () => {
    await expect(
      interpretCurriculumFeedback({
        vacancy_id: 'vacancy-1',
        application_id: '9001',
        perception: '   ',
      }),
    ).rejects.toThrow('A percepção do RH é obrigatória.')
    await expect(
      interpretCurriculumFeedback({
        vacancy_id: 'vacancy-1',
        application_id: '9001',
        perception: 'ab',
      }),
    ).rejects.toThrow('A percepção do RH deve ter ao menos 3 caracteres.')
    await expect(
      interpretCurriculumFeedback({
        vacancy_id: 'vacancy-1',
        application_id: '9001',
        perception: 'x'.repeat(4001),
      }),
    ).rejects.toThrow('A percepção do RH deve ter no máximo 4000 caracteres.')
    expect(irisBrowserAdapterRequest).not.toHaveBeenCalled()
  })

  it('validates perception by trimmed ECMAScript UTF-16 units without changing the sent text', async () => {
    const response = {
      ok: true,
      operation: 'interpret_curriculum_feedback',
      agent: 'iris',
      fallback: false,
      understanding: 'Entendimento',
      justification: 'Justificativa',
      feedback_proof: { expires_at: 1791120000, signature: 'a'.repeat(64) },
    }
    irisBrowserAdapterRequest.mockResolvedValue(response)

    for (const invalidPerception of ['  ab  ', '😀', '😀'.repeat(2001)]) {
      await expect(
        interpretCurriculumFeedback({
          vacancy_id: 'vacancy-1',
          application_id: '9001',
          perception: invalidPerception,
        }),
      ).rejects.toThrow()
    }

    const exactPerception = `  ${'😀'.repeat(2000)}  `
    await expect(
      interpretCurriculumFeedback({
        vacancy_id: 'vacancy-1',
        application_id: '9001',
        perception: exactPerception,
      }),
    ).resolves.toEqual(response)
    expect(irisBrowserAdapterRequest).toHaveBeenLastCalledWith(
      '/v1/pessoas/iris/gv-rh/browser/vacancies/vacancy-1/curriculum-feedback/interpret',
      { application_id: '9001', perception: exactPerception },
    )
  })

  it.each(['\ud83d', '\ude00', '\ud83dA\ude00'])(
    'rejects ill-formed UTF-16 perception before calling the Gateway',
    async (illFormed) => {
      await expect(
        interpretCurriculumFeedback({
          vacancy_id: 'vacancy-1',
          application_id: '9001',
          perception: `Percepção ${illFormed}`,
        }),
      ).rejects.toThrow('A percepção do RH contém texto Unicode inválido.')
      expect(irisBrowserAdapterRequest).not.toHaveBeenCalled()
    },
  )

  it('rejects a fallback or incomplete Íris interpretation', async () => {
    irisBrowserAdapterRequest.mockResolvedValue({
      ok: true,
      operation: 'interpret_curriculum_feedback',
      agent: 'iris',
      fallback: true,
      understanding: 'Entendimento',
      justification: 'Justificativa',
      feedback_proof: { expires_at: 1791120000, signature: 'a'.repeat(64) },
    })

    await expect(
      interpretCurriculumFeedback({
        vacancy_id: 'vacancy-1',
        application_id: '9001',
        perception: 'Percepção válida',
      }),
    ).rejects.toThrow('Não foi possível validar o entendimento da Íris.')
  })

  it.each([
    ['blank understanding', ' \n ', 'Justificativa'],
    ['blank justification', 'Entendimento', '\t '],
    ['oversized UTF-16 understanding', '😀'.repeat(2001), 'Justificativa'],
    ['oversized UTF-16 justification', 'Entendimento', ` ${'😀'.repeat(2001)} `],
  ])('rejects an interpretation with %s', async (_label, understanding, justification) => {
    irisBrowserAdapterRequest.mockResolvedValue({
      ok: true,
      operation: 'interpret_curriculum_feedback',
      agent: 'iris',
      fallback: false,
      understanding,
      justification,
      feedback_proof: { expires_at: 1791120000, signature: 'a'.repeat(64) },
    })

    await expect(
      interpretCurriculumFeedback({
        vacancy_id: 'vacancy-1',
        application_id: '9001',
        perception: 'Percepção válida',
      }),
    ).rejects.toThrow('Não foi possível validar o entendimento da Íris.')
  })

  it.each([
    ['understanding', '\ud83d', 'Justificativa'],
    ['justification', 'Entendimento', '\ude00'],
    ['malformed sequence', 'Entendimento', '\ud83dA\ude00'],
  ])('rejects ill-formed UTF-16 in model %s', async (_label, understanding, justification) => {
    irisBrowserAdapterRequest.mockResolvedValue({
      ok: true,
      operation: 'interpret_curriculum_feedback',
      agent: 'iris',
      fallback: false,
      understanding,
      justification,
      feedback_proof: { expires_at: 1791120000, signature: 'a'.repeat(64) },
    })

    await expect(
      interpretCurriculumFeedback({
        vacancy_id: 'vacancy-1',
        application_id: '9001',
        perception: 'Percepção válida',
      }),
    ).rejects.toThrow('Não foi possível validar o entendimento da Íris.')
  })

  it('accepts and preserves padded interpretation text at the 4000 UTF-16-unit boundary', async () => {
    const response = {
      ok: true,
      operation: 'interpret_curriculum_feedback',
      agent: 'iris',
      fallback: false,
      understanding: ` ${'😀'.repeat(2000)} `,
      justification: ' Justificativa exata. ',
      feedback_proof: { expires_at: 1791120000, signature: 'a'.repeat(64) },
    }
    irisBrowserAdapterRequest.mockResolvedValue(response)

    await expect(
      interpretCurriculumFeedback({
        vacancy_id: 'vacancy-1',
        application_id: '9001',
        perception: 'Percepção válida',
      }),
    ).resolves.toEqual(response)
  })

  it('confirms once through the Gateway and returns the persisted readback', async () => {
    const response = {
      ok: true,
      verified: true,
      duplicate: false,
      feedback_id: 'feedback-3',
      calibration_state: 'pending_review',
    }
    irisBrowserAdapterRequest.mockResolvedValue(response)

    await expect(
      confirmCurriculumFeedback({
        vacancy_id: 'vacancy-1',
        application_id: '9001',
        perception: 'Há experiência aderente no currículo.',
        understanding: 'O RH identificou experiência relevante não considerada.',
        justification: 'A experiência aparece no histórico profissional da candidatura.',
        complement: 'Considerar também a experiência recente.',
        feedback_proof: { expires_at: 1791120000, signature: 'a'.repeat(64) },
      }),
    ).resolves.toEqual(response)
    expect(irisBrowserAdapterRequest).toHaveBeenCalledWith(
      '/v1/pessoas/iris/gv-rh/browser/vacancies/vacancy-1/curriculum-feedback/confirm',
      {
        application_id: '9001',
        perception: 'Há experiência aderente no currículo.',
        understanding: 'O RH identificou experiência relevante não considerada.',
        justification: 'A experiência aparece no histórico profissional da candidatura.',
        confirmation: 'complemented',
        complement: 'Considerar também a experiência recente.',
        feedback_proof: { expires_at: 1791120000, signature: 'a'.repeat(64) },
      },
    )
  })

  it('marks confirmation without complement as confirmed', async () => {
    irisBrowserAdapterRequest.mockResolvedValue({
      ok: true,
      verified: true,
      duplicate: false,
      feedback_id: 'feedback-4',
      calibration_state: 'pending_review',
    })

    await confirmCurriculumFeedback({
      vacancy_id: 'vacancy-1',
      application_id: '9001',
      perception: 'Percepção',
      understanding: 'Entendimento',
      justification: 'Justificativa',
      complement: '',
      feedback_proof: { expires_at: 1791120000, signature: 'a'.repeat(64) },
    })

    expect(irisBrowserAdapterRequest.mock.calls[0][1]).toMatchObject({
      confirmation: 'confirmed',
      complement: '',
    })
  })

  it('canonicalizes a whitespace-only complement to the exact confirmed contract', async () => {
    irisBrowserAdapterRequest.mockResolvedValue({
      ok: true,
      verified: true,
      duplicate: false,
      feedback_id: 'feedback-4',
      calibration_state: 'pending_review',
    })

    await confirmCurriculumFeedback({
      vacancy_id: 'vacancy-1',
      application_id: '9001',
      perception: 'Percepção',
      understanding: 'Entendimento',
      justification: 'Justificativa',
      complement: '  \n\t ',
      feedback_proof: { expires_at: 1791120000, signature: 'a'.repeat(64) },
    })

    expect(irisBrowserAdapterRequest.mock.calls[0][1]).toMatchObject({
      confirmation: 'confirmed',
      complement: '',
    })
  })

  it('rejects an oversized optional complement before confirmation', async () => {
    await expect(
      confirmCurriculumFeedback({
        vacancy_id: 'vacancy-1',
        application_id: '9001',
        perception: 'Percepção',
        understanding: 'Entendimento',
        justification: 'Justificativa',
        complement: 'x'.repeat(4001),
        feedback_proof: { expires_at: 1791120000, signature: 'a'.repeat(64) },
      }),
    ).rejects.toThrow('O complemento deve ter no máximo 4000 caracteres.')
    expect(irisBrowserAdapterRequest).not.toHaveBeenCalled()
  })

  it('rejects invalid semantic confirmation fields and uses raw UTF-16 units for complement', async () => {
    const valid = {
      vacancy_id: 'vacancy-1',
      application_id: '9001',
      perception: 'Percepção',
      understanding: 'Entendimento',
      justification: 'Justificativa',
      complement: '',
      feedback_proof: { expires_at: 1791120000, signature: 'a'.repeat(64) },
    }

    await expect(confirmCurriculumFeedback({ ...valid, perception: '  ab  ' })).rejects.toThrow()
    await expect(confirmCurriculumFeedback({ ...valid, understanding: ' \n ' })).rejects.toThrow()
    await expect(
      confirmCurriculumFeedback({ ...valid, justification: '😀'.repeat(2001) }),
    ).rejects.toThrow()
    await expect(
      confirmCurriculumFeedback({ ...valid, complement: '😀'.repeat(2001) }),
    ).rejects.toThrow('O complemento deve ter no máximo 4000 caracteres.')
    expect(irisBrowserAdapterRequest).not.toHaveBeenCalled()
  })

  it.each(['perception', 'understanding', 'justification', 'complement'] as const)(
    'rejects ill-formed UTF-16 confirmation %s before calling the Gateway',
    async (field) => {
      const valid = {
        vacancy_id: 'vacancy-1',
        application_id: '9001',
        perception: 'Percepção',
        understanding: 'Entendimento',
        justification: 'Justificativa',
        complement: '',
        feedback_proof: { expires_at: 1791120000, signature: 'a'.repeat(64) },
      }

      await expect(confirmCurriculumFeedback({ ...valid, [field]: `texto\ud83d` })).rejects.toThrow()
      expect(irisBrowserAdapterRequest).not.toHaveBeenCalled()
    },
  )

  it('accepts and preserves valid astral text across all confirmation fields', async () => {
    const response = {
      ok: true,
      verified: true,
      duplicate: false,
      feedback_id: 'feedback-astral',
      calibration_state: 'pending_review' as const,
    }
    irisBrowserAdapterRequest.mockResolvedValue(response)
    const input = {
      vacancy_id: 'vacancy-1',
      application_id: '9001',
      perception: 'a😀',
      understanding: '😀',
      justification: '😀',
      complement: '😀',
      feedback_proof: { expires_at: 1791120000, signature: 'a'.repeat(64) },
    }

    await expect(confirmCurriculumFeedback(input)).resolves.toEqual(response)
    expect(irisBrowserAdapterRequest.mock.calls[0][1]).toMatchObject({
      perception: input.perception,
      understanding: input.understanding,
      justification: input.justification,
      complement: input.complement,
    })
  })

  it('rejects confirmation responses without persisted readback verification', async () => {
    irisBrowserAdapterRequest.mockResolvedValue({
      ok: true,
      verified: false,
      duplicate: false,
      feedback_id: 'feedback-3',
      calibration_state: 'pending_review',
    })

    await expect(
      confirmCurriculumFeedback({
        vacancy_id: 'vacancy-1',
        application_id: '9001',
        perception: 'Percepção',
        understanding: 'Entendimento',
        justification: 'Justificativa',
        complement: '',
        feedback_proof: { expires_at: 1791120000, signature: 'a'.repeat(64) },
      }),
    ).rejects.toThrow('Não foi possível verificar a persistência do feedback.')
  })
})
