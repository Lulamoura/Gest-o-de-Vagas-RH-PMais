import type { VacancyRecord } from '@/types'
import { calculateDaysOpen } from '@/lib/status-utils'

let _overdueThreshold = 30

export function setOverdueThreshold(days: number) {
  if (typeof days === 'number' && days > 0) {
    _overdueThreshold = days
  }
}

export function getOverdueThreshold() {
  return _overdueThreshold
}

export function isVacancyOverdue(
  vacancy: VacancyRecord | undefined | null,
  threshold?: number,
): boolean {
  if (!vacancy) return false
  if (vacancy.status_vaga !== 'Aberta') return false
  return calculateDaysOpen(vacancy.data_abertura) > (threshold ?? _overdueThreshold)
}
