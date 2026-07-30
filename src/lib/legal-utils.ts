export function formatCNJNumber(str: string): string {
  if (!str) return '—'
  const clean = str.replace(/[^\d]/g, '')
  if (clean.length !== 20) return str
  return `${clean.slice(0, 7)}-${clean.slice(7, 9)}.${clean.slice(9, 13)}.${clean.slice(13, 14)}.${clean.slice(14, 16)}.${clean.slice(16, 20)}`
}

export function getField(obj: Record<string, any> | null | undefined, ...keys: string[]): string {
  if (!obj || typeof obj !== 'object') return '—'
  for (const k of keys) {
    if (obj[k] != null && String(obj[k]).trim() !== '') {
      return String(obj[k]).trim()
    }
  }
  return '—'
}

export function getNestedField(
  obj: Record<string, any> | null | undefined,
  ...paths: string[]
): string {
  if (!obj || typeof obj !== 'object') return '—'
  for (const p of paths) {
    const parts = p.split('.')
    let current: any = obj
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part]
      } else {
        current = null
        break
      }
    }
    if (current != null && typeof current !== 'object' && String(current).trim() !== '') {
      return String(current).trim()
    }
  }
  return '—'
}

export interface TribunalInfo {
  sigla: string
  nome: string
  display: string
}

export function getTribunalInfo(proc: any): TribunalInfo {
  if (!proc || typeof proc !== 'object') {
    return { sigla: '—', nome: '—', display: '—' }
  }

  let sigla = '—'
  let nome = '—'

  if (typeof proc.tribunal === 'object' && proc.tribunal !== null) {
    sigla = proc.tribunal.sigla || proc.tribunal.nome || '—'
    nome = proc.tribunal.nome || proc.tribunal.sigla || '—'
  } else if (typeof proc.tribunal === 'string' && proc.tribunal.trim()) {
    sigla = proc.tribunal.trim()
    nome = proc.tribunal.trim()
  } else if (proc.orgao_julgador) {
    if (typeof proc.orgao_julgador === 'object') {
      nome = proc.orgao_julgador.nome || proc.orgao_julgador.sigla || '—'
      sigla = proc.orgao_julgador.sigla || proc.orgao_julgador.nome || '—'
    } else if (typeof proc.orgao_julgador === 'string') {
      nome = proc.orgao_julgador
      sigla = proc.orgao_julgador
    }
  } else if (proc.unidade_jurisdicional) {
    if (typeof proc.unidade_jurisdicional === 'object') {
      nome = proc.unidade_jurisdicional.nome || '—'
      sigla = proc.unidade_jurisdicional.sigla || '—'
    }
  }

  if (sigla === '—' && proc.tribunal_sigla) sigla = String(proc.tribunal_sigla)
  if (nome === '—' && proc.tribunal_nome) nome = String(proc.tribunal_nome)

  const display =
    sigla !== '—' && nome !== '—' && sigla !== nome
      ? `${sigla} - ${nome}`
      : sigla !== '—'
        ? sigla
        : nome !== '—'
          ? nome
          : '—'

  return { sigla, nome, display }
}

export function getProcessNumber(proc: any): string {
  if (!proc || typeof proc !== 'object') return '—'
  const num =
    proc.numero_cnj || proc.numero || proc.numero_processo || proc.titulo || proc.id || '—'
  if (num === '—') return '—'
  return String(num).trim()
}

export function getProcessClass(proc: any): string {
  if (!proc || typeof proc !== 'object') return '—'
  if (typeof proc.classe === 'object' && proc.classe !== null) {
    return proc.classe.nome || proc.classe.descricao || proc.classe.sigla || '—'
  }
  if (typeof proc.classe === 'string' && proc.classe.trim()) {
    return proc.classe.trim()
  }
  if (typeof proc.classe_principal === 'object' && proc.classe_principal !== null) {
    return proc.classe_principal.nome || '—'
  }
  return getField(proc, 'classe_nome', 'classe_cnj', 'natureza', 'tipo')
}

export function getProcessAssunto(proc: any): string {
  if (!proc || typeof proc !== 'object') return '—'

  if (Array.isArray(proc.assuntos) && proc.assuntos.length > 0) {
    const names = proc.assuntos
      .map((a: any) => {
        if (typeof a === 'string') return a.trim()
        if (typeof a === 'object' && a !== null) return a.nome || a.descricao || a.titulo || ''
        return ''
      })
      .filter(Boolean)
    if (names.length > 0) return names.join(', ')
  }

  if (typeof proc.assuntos === 'string' && proc.assuntos.trim()) {
    return proc.assuntos.trim()
  }

  if (typeof proc.assunto_principal === 'object' && proc.assunto_principal !== null) {
    return proc.assunto_principal.nome || proc.assunto_principal.descricao || '—'
  }

  if (typeof proc.assunto === 'object' && proc.assunto !== null) {
    return proc.assunto.nome || proc.assunto.descricao || '—'
  }

  return getField(proc, 'assunto', 'assunto_normalizado', 'ramo_direito')
}

export function getProcessVara(proc: any): string {
  if (!proc || typeof proc !== 'object') return '—'
  if (typeof proc.orgao_julgador === 'object' && proc.orgao_julgador !== null) {
    return proc.orgao_julgador.nome || proc.orgao_julgador.descricao || '—'
  }
  if (typeof proc.unidade_jurisdicional === 'object' && proc.unidade_jurisdicional !== null) {
    return proc.unidade_jurisdicional.nome || '—'
  }
  return getField(proc, 'orgao_julgador', 'vara', 'unidade_jurisdicional', 'foro')
}

export function getProcessData(proc: any): string {
  if (!proc || typeof proc !== 'object') return '—'

  const rawDate =
    proc.data_distribuicao ||
    proc.data_inicio ||
    proc.data_ajuizamento ||
    proc.data_abertura ||
    proc.created_at ||
    proc.data_ultima_movimentacao

  if (!rawDate || rawDate === '—') return '—'

  const str = String(rawDate).trim()
  if (str.includes('T')) {
    const parts = str.split('T')[0].split('-')
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  if (str.includes('-')) {
    const parts = str.split('-')
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return str
}

export function getProcessValorCausa(proc: any): string {
  if (!proc || typeof proc !== 'object') return '—'
  if (typeof proc.valor_causa === 'object' && proc.valor_causa !== null) {
    const val = proc.valor_causa.valor || proc.valor_causa.quantia
    if (val != null) {
      const num = Number(val)
      if (!isNaN(num)) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
      }
    }
    if (proc.valor_causa.valor_formatado) return String(proc.valor_causa.valor_formatado)
  }
  if (typeof proc.valor_causa === 'number') {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
      proc.valor_causa,
    )
  }
  if (typeof proc.valor_causa === 'string' && proc.valor_causa.trim()) {
    return proc.valor_causa.trim()
  }
  return getField(proc, 'valor_causa', 'valor')
}

export function getProcessJuiz(proc: any): string {
  return getField(proc, 'juiz', 'magistrado', 'relator')
}

export function getProcessStatus(proc: any): string {
  return getField(proc, 'status', 'situacao', 'estado')
}

export function getTopAssuntos(processos: any[]): { label: string; count: number }[] {
  if (!Array.isArray(processos)) return []
  const counts: Record<string, number> = {}

  processos.forEach((p) => {
    const assuntoStr = getProcessAssunto(p)
    if (assuntoStr && assuntoStr !== '—') {
      const parts = assuntoStr.split(',')
      parts.forEach((pt) => {
        const cleaned = pt.trim()
        if (cleaned) {
          counts[cleaned] = (counts[cleaned] || 0) + 1
        }
      })
    }
  })

  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

export interface ProcessParte {
  nome: string
  tipo: string
  advogados: string[]
}

export function getProcessPartes(proc: any): ProcessParte[] {
  if (!proc || typeof proc !== 'object') return []

  const list = proc.partes || proc.envolvidos || proc.polos || []
  if (!Array.isArray(list)) return []

  return list
    .map((item: any) => {
      if (!item) return null
      if (typeof item === 'string') {
        return { nome: item.trim(), tipo: 'Parte', advogados: [] }
      }
      const nome =
        item.nome || item.nome_normalizado || item.nome_espelho || item.razao_social || '—'

      let tipo =
        item.tipo || item.papel || item.qualificacao || item.tipo_atuacao || item.polo || 'Parte'

      if (typeof tipo === 'object' && tipo !== null) {
        tipo = tipo.nome || tipo.descricao || 'Parte'
      }

      const advs: string[] = []
      if (Array.isArray(item.advogados)) {
        item.advogados.forEach((adv: any) => {
          if (typeof adv === 'string') advs.push(adv.trim())
          else if (typeof adv === 'object' && adv !== null && adv.nome) advs.push(adv.nome.trim())
        })
      }

      return {
        nome: String(nome).trim(),
        tipo: String(tipo).trim(),
        advogados: advs,
      }
    })
    .filter((p): p is ProcessParte => p !== null && p.nome !== '—')
}

export function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(d)
  } catch {
    return dateStr
  }
}
