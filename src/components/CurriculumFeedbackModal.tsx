import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Loader2, MessageSquareText, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import {
  canConfirmCurriculumFeedback,
  canRequestCurriculumFeedbackInterpretation,
  createInitialCurriculumFeedbackState,
  curriculumFeedbackReducer,
  filterCurriculumFeedbackVacancies,
} from '@/lib/curriculum-feedback'
import { cn } from '@/lib/utils'
import { formatDateBR } from '@/lib/status-utils'
import {
  confirmCurriculumFeedback,
  interpretCurriculumFeedback,
  searchCurriculumApplications,
  type CurriculumApplicationSearchResult,
} from '@/services/curriculumFeedback'
import { getVacancies } from '@/services/vacancies'
import type { VacancyRecord } from '@/types'

interface CurriculumFeedbackModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

const getVacancyLabel = (vacancy: VacancyRecord) => {
  const role = vacancy.expand?.cargo?.nome
  const client = vacancy.expand?.cliente?.nome
  return [role, client].filter(Boolean).join(' — ') || `Vaga ${vacancy.id}`
}

export function CurriculumFeedbackModal({ open, onOpenChange }: CurriculumFeedbackModalProps) {
  const [state, dispatch] = useReducer(
    curriculumFeedbackReducer,
    undefined,
    createInitialCurriculumFeedbackState,
  )
  const [vacancies, setVacancies] = useState<VacancyRecord[]>([])
  const [loadingVacancies, setLoadingVacancies] = useState(false)
  const [vacancyOpen, setVacancyOpen] = useState(false)
  const [applicationOpen, setApplicationOpen] = useState(false)
  const [applicationQuery, setApplicationQuery] = useState('')
  const [applications, setApplications] = useState<CurriculumApplicationSearchResult[]>([])
  const [searchingApplications, setSearchingApplications] = useState(false)
  const [interpreting, setInterpreting] = useState(false)
  const requestSequence = useRef(0)
  const modalGeneration = useRef(0)
  const interpretingRef = useRef(false)
  const confirmingRef = useRef(false)

  const selectedVacancy = useMemo(
    () => vacancies.find((vacancy) => vacancy.id === state.vacancyId) || null,
    [state.vacancyId, vacancies],
  )

  useEffect(() => {
    if (!open) return
    let active = true
    setLoadingVacancies(true)
    getVacancies()
      .then((records) => {
        if (active) setVacancies(filterCurriculumFeedbackVacancies(records))
      })
      .catch((error) => {
        if (active) {
          toast.error(getErrorMessage(error, 'Não foi possível carregar as vagas do GV.'))
        }
      })
      .finally(() => {
        if (active) setLoadingVacancies(false)
      })
    return () => {
      active = false
    }
  }, [open])

  useEffect(() => {
    const query = applicationQuery.trim()
    const sequence = ++requestSequence.current
    if (!state.vacancyId || query.length < 2) {
      setApplications([])
      setSearchingApplications(false)
      return
    }

    setSearchingApplications(true)
    const timer = window.setTimeout(() => {
      searchCurriculumApplications(state.vacancyId, query)
        .then((results) => {
          if (requestSequence.current === sequence) setApplications(results)
        })
        .catch((error) => {
          if (requestSequence.current === sequence) {
            setApplications([])
            toast.error(getErrorMessage(error, 'Não foi possível buscar as candidaturas.'))
          }
        })
        .finally(() => {
          if (requestSequence.current === sequence) setSearchingApplications(false)
        })
    }, 300)

    return () => window.clearTimeout(timer)
  }, [applicationQuery, state.vacancyId])

  const resetLocalState = () => {
    requestSequence.current += 1
    modalGeneration.current += 1
    interpretingRef.current = false
    confirmingRef.current = false
    setApplicationQuery('')
    setApplications([])
    setSearchingApplications(false)
    setInterpreting(false)
    setVacancyOpen(false)
    setApplicationOpen(false)
    dispatch({ type: 'RESET' })
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (state.submitting || confirmingRef.current) return
      resetLocalState()
    }
    onOpenChange(nextOpen)
  }

  const handleVacancySelect = (vacancyId: string) => {
    dispatch({ type: 'SELECT_VACANCY', vacancyId })
    setApplicationQuery('')
    setApplications([])
    setVacancyOpen(false)
  }

  const handleInterpret = async () => {
    if (!canRequestCurriculumFeedbackInterpretation(state) || interpretingRef.current) return
    const generation = modalGeneration.current
    const revision = state.revision
    interpretingRef.current = true
    setInterpreting(true)
    try {
      const interpretation = await interpretCurriculumFeedback({
        vacancy_id: state.vacancyId,
        application_id: state.selectedApplication!.application_id,
        perception: state.perception,
      })
      if (modalGeneration.current === generation) {
        dispatch({ type: 'SHOW_REVIEW', revision, interpretation })
      }
    } catch (error) {
      if (modalGeneration.current === generation) {
        toast.error(getErrorMessage(error, 'Não foi possível obter o entendimento da Íris.'))
      }
    } finally {
      if (modalGeneration.current === generation) {
        interpretingRef.current = false
        setInterpreting(false)
      }
    }
  }

  const handleConfirm = async () => {
    if (!canConfirmCurriculumFeedback(state) || confirmingRef.current) return
    confirmingRef.current = true
    dispatch({ type: 'SUBMIT_START' })
    try {
      await confirmCurriculumFeedback({
        vacancy_id: state.vacancyId,
        application_id: state.selectedApplication!.application_id,
        perception: state.perception,
        understanding: state.interpretation!.understanding,
        justification: state.interpretation!.justification,
        complement: state.complement,
        feedback_proof: state.interpretation!.feedback_proof,
      })
      resetLocalState()
      onOpenChange(false)
      toast.success('Feedback curricular registrado e enviado para revisão.')
    } catch (error) {
      confirmingRef.current = false
      dispatch({ type: 'SUBMIT_FAILURE' })
      toast.error(getErrorMessage(error, 'Não foi possível confirmar o feedback curricular.'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-2xl"
        onEscapeKeyDown={(event) => {
          if (state.submitting) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (state.submitting) event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5 text-indigo-600" />
            Feedback curricular
          </DialogTitle>
          <DialogDescription>
            {state.step === 'capture'
              ? 'Selecione a vaga e a candidatura para compartilhar sua percepção com a Íris.'
              : 'Revise o entendimento da Íris antes de confirmar.'}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Este feedback não altera ranking, status ou critérios da vaga/candidatura. Ele será
              enviado para revisão e calibração.
            </p>
          </div>
        </div>

        {state.step === 'capture' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Vaga do GV com vínculo WordPress</Label>
              <Popover open={vacancyOpen} onOpenChange={setVacancyOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={vacancyOpen}
                    className="w-full justify-between font-normal"
                    disabled={loadingVacancies}
                  >
                    <span className="truncate">
                      {loadingVacancies
                        ? 'Carregando vagas...'
                        : selectedVacancy
                          ? getVacancyLabel(selectedVacancy)
                          : 'Selecionar vaga'}
                    </span>
                    {loadingVacancies ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-0"
                  align="start"
                >
                  <Command>
                    <CommandInput placeholder="Buscar vaga..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma vaga vinculada ao WordPress.</CommandEmpty>
                      <CommandGroup>
                        {vacancies.map((vacancy) => (
                          <CommandItem
                            key={vacancy.id}
                            value={getVacancyLabel(vacancy)}
                            onSelect={() => handleVacancySelect(vacancy.id)}
                          >
                            <Check
                              className={cn(
                                'h-4 w-4',
                                state.vacancyId === vacancy.id ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            <span className="truncate">{getVacancyLabel(vacancy)}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Candidatura WordPress</Label>
              <Popover
                open={applicationOpen}
                onOpenChange={(nextOpen) => state.vacancyId && setApplicationOpen(nextOpen)}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={applicationOpen}
                    className="w-full justify-between font-normal"
                    disabled={!state.vacancyId}
                  >
                    <span className="truncate">
                      {state.selectedApplication?.name ||
                        (state.vacancyId ? 'Buscar candidatura' : 'Selecione uma vaga primeiro')}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-0"
                  align="start"
                >
                  <Command shouldFilter={false}>
                    <CommandInput
                      value={applicationQuery}
                      onValueChange={(value) => {
                        setApplicationQuery(value)
                        if (state.selectedApplication) {
                          dispatch({ type: 'SELECT_APPLICATION', application: null })
                        }
                      }}
                      placeholder="Digite ao menos 2 caracteres..."
                    />
                    <CommandList>
                      {applicationQuery.trim().length < 2 ? (
                        <div className="p-4 text-center text-sm text-slate-500">
                          Digite ao menos 2 caracteres do nome.
                        </div>
                      ) : searchingApplications ? (
                        <div className="flex items-center justify-center gap-2 p-4 text-sm text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" /> Buscando candidaturas...
                        </div>
                      ) : applications.length === 0 ? (
                        <CommandEmpty>Nenhuma candidatura encontrada.</CommandEmpty>
                      ) : (
                        <CommandGroup>
                          {applications.map((application) => (
                            <CommandItem
                              key={application.application_id}
                              value={application.application_id}
                              onSelect={() => {
                                dispatch({ type: 'SELECT_APPLICATION', application })
                                setApplicationOpen(false)
                              }}
                              className="items-start"
                            >
                              <Check
                                className={cn(
                                  'mt-0.5 h-4 w-4',
                                  state.selectedApplication?.application_id ===
                                    application.application_id
                                    ? 'opacity-100'
                                    : 'opacity-0',
                                )}
                              />
                              <div className="min-w-0">
                                <p className="truncate font-medium">{application.name}</p>
                                <p className="text-xs text-slate-500">
                                  {formatDateBR(application.applied_at)} ·{' '}
                                  {application.masked_email}
                                </p>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {state.selectedApplication && (
                <p className="text-xs text-slate-500">
                  {formatDateBR(state.selectedApplication.applied_at)} ·{' '}
                  {state.selectedApplication.masked_email}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="curriculum-feedback-perception">Percepção do RH</Label>
                <span className="text-xs text-slate-500">
                  {state.perception.trim().length}/4000
                </span>
              </div>
              <Textarea
                id="curriculum-feedback-perception"
                value={state.perception}
                onChange={(event) =>
                  dispatch({ type: 'SET_PERCEPTION', perception: event.target.value })
                }
                required
                rows={6}
                placeholder="Descreva livremente o que deveria ser revisto na análise curricular."
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border bg-slate-50 p-3 text-sm">
              <p className="font-medium text-slate-900">Entendimento da Íris</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-700">
                {state.interpretation?.understanding}
              </p>
            </div>
            <div className="rounded-md border bg-slate-50 p-3 text-sm">
              <p className="font-medium text-slate-900">Justificativa da Íris</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-700">
                {state.interpretation?.justification}
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="curriculum-feedback-complement">Complemento opcional</Label>
                <span className="text-xs text-slate-500">{state.complement.length}/4000</span>
              </div>
              <Textarea
                id="curriculum-feedback-complement"
                value={state.complement}
                onChange={(event) =>
                  dispatch({ type: 'SET_COMPLEMENT', complement: event.target.value })
                }
                maxLength={4000}
                rows={5}
                placeholder="Acrescente um contexto final, se necessário."
                disabled={state.submitting}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={state.submitting}
          >
            Cancelar
          </Button>
          {state.step === 'capture' ? (
            <Button
              type="button"
              onClick={handleInterpret}
              disabled={!canRequestCurriculumFeedbackInterpretation(state) || interpreting}
            >
              {interpreting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Revisar com a Íris
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => dispatch({ type: 'BACK' })}
                disabled={state.submitting}
              >
                Voltar
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={!canConfirmCurriculumFeedback(state)}
              >
                {state.submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
