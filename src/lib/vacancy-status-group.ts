import { VacancyStatus } from '@/types'

export type VacancyStatusGroup = 'Em andamento' | 'Fechadas'

const IN_PROGRESS_STATUSES: VacancyStatus[] = ['Aberta']

const CLOSED_STATUSES: VacancyStatus[] = ['Concluída', 'Cancelada']

export const isVacancyInGroup = (status: VacancyStatus, group: VacancyStatusGroup): boolean => {
  if (group === 'Em andamento') return IN_PROGRESS_STATUSES.includes(status)
  return CLOSED_STATUSES.includes(status)
}
