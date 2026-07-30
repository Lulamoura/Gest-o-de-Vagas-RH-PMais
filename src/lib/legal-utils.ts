export function formatCNJNumber(str: string): string {
  if (!str) return '—'
  const digits = str.replace(/[^\d]/g, '')
  if (digits.length === 20) {
    return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`
  }
  return str
}

export function getField(obj: Record<string, any> | null | undefined, ...keys: string[]): string {
  if (!obj || typeof obj !== 'object') return '—'
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') {
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
  for (const path of paths) {
    const parts = path.split('.')
    let curr: any = obj
    let valid = true
    for (const p of parts) {
      if (curr && typeof curr === 'object' && p in curr) {
        curr = curr[p]
      } else {
        valid = false
        break
      }
    }
    if (valid && curr != null && curr !== '') {
      return String(curr).trim()
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
    return { sigla: '—', nome: '—', display: 'Tribunal não informado' }
  }

  let sigla = getNestedField(
    proc,
    'tribunal.sigla',
    'fontes.0.sigla',
    'tribunal_sigla',
    'sigla_tribunal',
  )
  let nome = getNestedField(
    proc,
    'tribunal.nome',
    'fontes.0.nome',
    'tribunal_nome',
    'nome_tribunal',
  )

  if (sigla === '—' && proc.titulo && typeof proc.titulo === 'string') {
    const match = proc.titulo.match(/do\s+([A-Z0-9\-_]+)/i)
    if (match && match[1]) sigla = match[1].toUpperCase()
  }

  const numStr = getProcessNumber(proc)
  const cleanDigits = numStr.replace(/[^\d]/g, '')
  if (cleanDigits.length === 20 && sigla === '—') {
    const j = cleanDigits.slice(13, 14)
    const tr = cleanDigits.slice(14, 16)
    if (j === '8') {
      const tjMap: Record<string, string> = {
        '17': 'TJPE',
        '26': 'TJSP',
        '13': 'TJMG',
        '19': 'TJRJ',
        '05': 'TJBA',
        '06': 'TJCE',
        '21': 'TJRS',
        '09': 'TJPR',
      }
      if (tjMap[tr]) {
        sigla = tjMap[tr]
        nome = `Tribunal de Justiça (${sigla})`
      }
    } else if (j === '5') {
      sigla = `TRT${parseInt(tr, 10)}`
      nome = `Tribunal Regional do Trabalho (${sigla})`
    } else if (j === '4') {
      sigla = `TRF${parseInt(tr, 10)}`
      nome = `Tribunal Regional Federal (${sigla})`
    }
  }

  if (sigla !== '—' && (nome === '—' || !nome)) {
    nome = `Tribunal (${sigla})`
  }

  let display = 'Tribunal não informado'
  if (sigla !== '—' && nome !== '—' && nome !== sigla) {
    display = `${sigla} — ${nome}`
  } else if (sigla !== '—') {
    display = sigla
  } else if (nome !== '—') {
    display = nome
  }

  return { sigla, nome, display }
}

export function getProcessNumber(proc: any): string {
  if (!proc || typeof proc !== 'object') return '—'
  const num = getNestedField(proc, 'numero_cnj', 'numero', 'numero_processo', 'titulo')
  if (num !== '—') {
    const match = num.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/)
    if (match) return match[0]
    const digits = num.replace(/[^\d]/g, '')
    if (digits.length === 20) return formatCNJNumber(digits)
    return num
  }
  return '—'
}

export function getProcessClass(proc: any): string {
  if (!proc || typeof proc !== 'object') return '—'
  return getNestedField(
    proc,
    'capa.classe',
    'classe',
    'fontes.0.capa.classe',
    'classe_nome',
    'tipo',
    'fontes.0.tipo',
  )
}

export function getProcessAssunto(proc: any): string {
  if (!proc || typeof proc !== 'object') return '—'

  const rawAssunto = proc.capa?.assunto || proc.assunto || proc.fontes?.[0]?.capa?.assunto
  if (typeof rawAssunto === 'string' && rawAssunto.trim()) return rawAssunto.trim()

  const rawAssuntos = proc.capa?.assuntos || proc.assuntos || proc.fontes?.[0]?.capa?.assuntos
  if (Array.isArray(rawAssuntos) && rawAssuntos.length > 0) {
    return rawAssuntos
      .map((a) => (typeof a === 'object' ? a?.nome || a?.titulo : String(a)))
      .filter(Boolean)
      .join(', ')
  }

  return getNestedField(proc, 'capa.assunto', 'assunto', 'assuntos', 'assunto_nome')
}

export function getProcessVara(proc: any): string {
  if (!proc || typeof proc !== 'object') return '—'
  return getNestedField(
    proc,
    'capa.orgao_julgador',
    'capa.vara',
    'orgao_julgador',
    'vara',
    'fontes.0.capa.orgao_julgador',
  )
}

export function getProcessData(proc: any): string {
  if (!proc || typeof proc !== 'object') return '—'
  const rawDate = getNestedField(
    proc,
    'capa.data_distribuicao',
    'data_distribuicao',
    'data_inicio',
    'data_ajuizamento',
    'fontes.0.capa.data_distribuicao',
    'fontes.0.data_inicio',
  )
  if (rawDate !== '—') {
    if (rawDate.includes('T')) {
      const [d] = rawDate.split('T')
      const [y, m, day] = d.split('-')
      if (y && m && day) return `${day}/${m}/${y}`
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      const [y, m, day] = rawDate.split('-')
      return `${day}/${m}/${y}`
    }
    return rawDate
  }
  return '—'
}

export function getProcessValorCausa(proc: any): string {
  if (!proc || typeof proc !== 'object') return '—'
  const val = proc.capa?.valor_causa || proc.valor_causa || proc.fontes?.[0]?.capa?.valor_causa
  if (val != null) {
    if (typeof val === 'object' && val.valor) {
      const m = val.moeda || 'R$'
      return `${m} ${Number(val.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    }
    if (typeof val === 'number') {
      return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    }
    if (typeof val === 'string' && val.trim()) {
      return val.trim()
    }
  }
  return '—'
}

export function getProcessJuiz(proc: any): string {
  if (!proc || typeof proc !== 'object') return '—'
  return getNestedField(proc, 'capa.juiz', 'juiz', 'relator')
}

export function getProcessStatus(proc: any): string {
  if (!proc || typeof proc !== 'object') return '—'
  return getNestedField(proc, 'status', 'situacao', 'fontes.0.status')
}

export function getTopAssuntos(processos: any[]): { label: string; count: number }[] {
  if (!Array.isArray(processos)) return []
  const map: Record<string, number> = {}
  for (const proc of processos) {
    const ass = getProcessAssunto(proc)
    if (ass && ass !== '—') {
      const parts = ass
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean)
      for (const p of parts) {
        map[p] = (map[p] || 0) + 1
      }
    }
  }
  return Object.entries(map)
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

  const rawPartes =
    proc.partes || proc.envolvidos || proc.fontes?.[0]?.envolvidos || proc.fontes?.[0]?.partes
  if (!Array.isArray(rawPartes)) return []

  return rawPartes.map((p: any) => {
    if (typeof p === 'string') {
      return { nome: p, tipo: 'Parte', advogados: [] }
    }
    const nome = p.nome || p.nome_envolvido || p.titulo || 'Desconhecido'
    const tipo = p.tipo || p.tipo_normalizado || p.polo || p.papel || 'Parte'
    const advs: string[] = []
    if (Array.isArray(p.advogados)) {
      p.advogados.forEach((a: any) => {
        if (typeof a === 'string') advs.push(a)
        else if (a && typeof a === 'object' && a.nome) advs.push(a.nome)
      })
    }
    return { nome, tipo, advogados: advs }
  })
}

export function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}
