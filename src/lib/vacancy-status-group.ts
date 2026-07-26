import { VacancyStatus } from '@/types'

export type VacancyStatusGroup = 'Em andamento' | 'Fechadas'

const IN_PROGRESS_STATUSES: VacancyStatus[] = [
  'Aberta',
  'Triagem',
  'Entrevistas',
  'Pré-Aprovação',
  'Alocação',
]

const CLOSED_STATUSES: VacancyStatus[] = ['Fechada', 'Cancelada']

export const isVacancyInGroup = (status: VacancyStatus, group: VacancyStatusGroup): boolean => {
  if (group === 'Em andamento') return IN_PROGRESS_STATUSES.includes(status)
  return CLOSED_STATUSES.includes(status)
}
