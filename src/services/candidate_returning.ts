import pb from '@/lib/pocketbase/client'
import { cleanCPF } from '@/lib/cpf-utils'
import type { CandidateRecord } from '@/types'

const EXPAND_RETURNING = 'vacancy_id,vacancy_id.cliente,vacancy_id.cargo'

export interface ReturningCandidateItem {
  id: string
  nome: string
  cargo?: string
  cliente?: string
  status_candidato: string
  created: string
  vacancy?: string
  expand?: CandidateRecord['expand']
}

/**
 * Escapes characters for PocketBase filter string.
 */
function escapeFilterString(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * Builds candidate duplicate lookup filter for a specific candidate.
 * Matches by CPF (raw or unformatted) or email, excluding the given candidate ID.
 */
function buildDuplicateFilter(params: {
  candidateId?: string
  cpf?: string | null
  email?: string | null
}): string | null {
  const { candidateId, cpf, email } = params
  const conditions: string[] = []

  const clean = cpf ? cleanCPF(cpf) : ''
  const rawCpf = cpf ? cpf.trim() : ''
  const trimmedEmail = email ? email.trim() : ''

  if (rawCpf) {
    conditions.push(`cpf = "${escapeFilterString(rawCpf)}"`)
  }
  if (clean && clean !== rawCpf) {
    conditions.push(`cpf = "${escapeFilterString(clean)}"`)
  }
  if (trimmedEmail) {
    conditions.push(`email = "${escapeFilterString(trimmedEmail)}"`)
  }

  if (conditions.length === 0) return null

  const orClause = conditions.length === 1 ? conditions[0] : `(${conditions.join(' || ')})`

  if (candidateId) {
    return `${orClause} && id != "${escapeFilterString(candidateId)}"`
  }

  return orClause
}

/**
 * Fetches previous/other processes for a given candidate by CPF or Email.
 * Returns records found with id, nome, cargo, cliente, status_candidato, created, vacancy.
 * If both CPF and email are empty, returns empty array.
 */
export const getCandidateReturningProcesses = async (params: {
  candidateId?: string
  cpf?: string | null
  email?: string | null
}): Promise<ReturningCandidateItem[]> => {
  const filter = buildDuplicateFilter(params)
  if (!filter) return []

  try {
    const list = await pb.collection('candidates').getFullList<CandidateRecord>({
      filter,
      expand: EXPAND_RETURNING,
      sort: '-created',
      batch: 200,
    })

    return list.map((item) => {
      const vacancy = item.expand?.vacancy_id
      const cargoName = vacancy?.expand?.cargo?.nome
      const clienteName = vacancy?.expand?.cliente?.nome
      const vacancyDisplayName = cargoName || clienteName || '—'

      return {
        id: item.id,
        nome: item.nome,
        cargo: cargoName,
        cliente: clienteName,
        status_candidato: item.status_candidato,
        created: item.created,
        vacancy: vacancyDisplayName,
        expand: item.expand,
      }
    })
  } catch (error) {
    console.error('Erro ao consultar candidatos retornantes:', error)
    return []
  }
}

/**
 * Computes returning counts for a list of candidate records in memory.
 * Keys by candidateId -> number of other candidate records sharing the same CPF/email.
 */
export function computeReturningCounts(
  candidateList: Array<{ id: string; cpf?: string | null; email?: string | null }>,
): Record<string, number> {
  const counts: Record<string, number> = {}
  const cpfToIds = new Map<string, Set<string>>()
  const emailToIds = new Map<string, Set<string>>()

  for (const c of candidateList) {
    const rawCpf = c.cpf ? c.cpf.trim() : ''
    const clean = rawCpf ? cleanCPF(rawCpf) : ''
    const email = c.email ? c.email.trim().toLowerCase() : ''

    if (clean) {
      if (!cpfToIds.has(clean)) cpfToIds.set(clean, new Set())
      cpfToIds.get(clean)!.add(c.id)
    }
    if (email) {
      if (!emailToIds.has(email)) emailToIds.set(email, new Set())
      emailToIds.get(email)!.add(c.id)
    }
  }

  for (const c of candidateList) {
    const matchingIds = new Set<string>()
    const rawCpf = c.cpf ? c.cpf.trim() : ''
    const clean = rawCpf ? cleanCPF(rawCpf) : ''
    const email = c.email ? c.email.trim().toLowerCase() : ''

    if (clean && cpfToIds.has(clean)) {
      cpfToIds.get(clean)!.forEach((id) => {
        if (id !== c.id) matchingIds.add(id)
      })
    }
    if (email && emailToIds.has(email)) {
      emailToIds.get(email)!.forEach((id) => {
        if (id !== c.id) matchingIds.add(id)
      })
    }

    counts[c.id] = matchingIds.size
  }

  return counts
}
