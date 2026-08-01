import type { VacancyRecord } from '@/types'
import { calculateDaysOpen } from '@/lib/status-utils'

export function isVacancyOverdue(vacancy: VacancyRecord | undefined | null): boolean {
  if (!vacancy) return false
  if (vacancy.status_vaga !== 'Aberta') return false
  return calculateDaysOpen(vacancy.data_abertura) > 30
}
