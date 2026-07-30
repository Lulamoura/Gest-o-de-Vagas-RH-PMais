export function getField(obj: Record<string, any> | null | undefined, ...keys: string[]): string {
  if (!obj) return '—'
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '' && obj[k] !== '—') return String(obj[k])
  }
  return '—'
}

export function getNestedField(
  obj: Record<string, any> | null | undefined,
  ...paths: string[]
): string {
  if (!obj) return '—'
  for (const path of paths) {
    const parts = path.split('.')
    let cur: any = obj
    let found = true
    for (const p of parts) {
      if (cur == null || typeof cur !== 'object') {
        found = false
        break
      }
      cur = cur[p]
    }
    if (found && cur != null && cur !== '' && cur !== '—') return String(cur)
  }
  return '—'
}

export interface TribunalInfo {
  sigla: string
  nome: string
  display: string
}

export function getTribunalInfo(proc: any): TribunalInfo {
  if (!proc) return { sigla: '', nome: '', display: '—' }

  let sigla = ''
  let nome = ''

  if (proc.tribunal) {
    if (typeof proc.tribunal === 'object') {
      sigla = proc.tribunal.sigla || proc.tribunal.sigla_tribunal || ''
      nome = proc.tribunal.nome || proc.tribunal.nome_tribunal || ''
    } else if (typeof proc.tribunal === 'string') {
      sigla = proc.tribunal
    }
  }

  if (!sigla && proc.tribunal_sigla) sigla = String(proc.tribunal_sigla)
  if (!nome && proc.tribunal_nome) nome = String(proc.tribunal_nome)

  if (proc.capa) {
    if (proc.capa.tribunal) {
      if (typeof proc.capa.tribunal === 'object') {
        if (!sigla) sigla = proc.capa.tribunal.sigla || ''
        if (!nome) nome = proc.capa.tribunal.nome || ''
      } else if (typeof proc.capa.tribunal === 'string' && !sigla) {
        sigla = proc.capa.tribunal
      }
    }
    if (!sigla && proc.capa.orgao_julgador) {
      const oj = String(proc.capa.orgao_julgador)
      if (oj.length <= 10 && oj.toUpperCase() === oj) sigla = oj
      else if (!nome) nome = oj
    }
  }

  if (Array.isArray(proc.fontes)) {
    for (const f of proc.fontes) {
      if (!f) continue
      if (f.tribunal && typeof f.tribunal === 'object') {
        if (!sigla) sigla = f.tribunal.sigla || ''
        if (!nome) nome = f.tribunal.nome || ''
      }
      if (!sigla && f.sigla) sigla = String(f.sigla)
      if (
        !nome &&
        f.nome &&
        typeof f.nome === 'string' &&
        f.nome.toLowerCase().includes('tribunal')
      ) {
        nome = f.nome
      }
      if (!sigla && f.nome && typeof f.nome === 'string') {
        const match = f.nome.match(/\b(TJ[A-Z]{2}|TRT\d{1,2}|TRF\d|STF|STJ|TST|TSE|STM)\b/i)
        if (match) sigla = match[1].toUpperCase()
      }
    }
  }

  if (!sigla && proc.orgao) {
    const o = String(proc.orgao)
    if (o.length <= 10 && o.toUpperCase() === o) sigla = o
    else if (!nome) nome = o
  }

  sigla = sigla.trim()
  nome = nome.trim()

  if (sigla && nome && sigla.toLowerCase() !== nome.toLowerCase()) {
    return { sigla, nome, display: `${sigla} — ${nome}` }
  }
  if (sigla) return { sigla, nome: '', display: sigla }
  if (nome) return { sigla: '', nome, display: nome }

  return { sigla: '', nome: '', display: '—' }
}

export function getProcessNumber(proc: any): string {
  if (!proc) return '—'
  return getNestedField(
    proc,
    'numero_cnj',
    'numero',
    'numero_processo',
    'titulo',
    'capa.numero',
    'fontes.0.numero_processo',
  )
}

export function getProcessClass(proc: any): string {
  if (!proc) return '—'

  const res = getNestedField(
    proc,
    'classe.nome',
    'classe.descricao',
    'classe_processual',
    'classe_nome',
    'capa.classe',
    'capa.classe_nome',
    'fontes.0.classe.nome',
    'fontes.0.capa.classe',
    'classe',
  )
  if (res !== '—') return res

  if (Array.isArray(proc.fontes)) {
    for (const f of proc.fontes) {
      const fClass = getNestedField(f, 'classe.nome', 'capa.classe', 'classe')
      if (fClass !== '—') return fClass
    }
  }

  return '—'
}

export function getProcessAssunto(proc: any): string {
  if (!proc) return '—'

  if (Array.isArray(proc.assuntos) && proc.assuntos.length > 0) {
    const list = proc.assuntos
      .map((a: any) => (typeof a === 'string' ? a : a?.nome || a?.descricao || a?.titulo || ''))
      .filter((s: string) => s && s !== '—')
    if (list.length > 0) return list.join(', ')
  }

  const capaAssunto = getNestedField(
    proc,
    'capa.assunto',
    'capa.assunto_principal',
    'capa.assuntos',
  )
  if (capaAssunto !== '—') return capaAssunto

  if (Array.isArray(proc.fontes) && proc.fontes.length > 0) {
    const fonteAssuntos: string[] = []
    for (const f of proc.fontes) {
      if (!f) continue
      const fa = getNestedField(f, 'assunto', 'descricao', 'capa.assunto', 'nome')
      if (fa !== '—' && !fonteAssuntos.includes(fa)) {
        fonteAssuntos.push(fa)
      }
    }
    if (fonteAssuntos.length > 0) return fonteAssuntos.join(', ')
  }

  const direct = getField(proc, 'assunto', 'descricao')
  if (direct !== '—') return direct

  return '—'
}

export function getProcessVara(proc: any): string {
  if (!proc) return '—'
  const res = getNestedField(
    proc,
    'capa.orgao_julgador',
    'orgao_julgador',
    'vara',
    'unidade',
    'capa.vara',
    'fontes.0.orgao_julgador',
    'fontes.0.vara',
  )
  if (res !== '—') return res

  if (Array.isArray(proc.fontes)) {
    for (const f of proc.fontes) {
      const fVara = getNestedField(f, 'orgao_julgador', 'vara', 'unidade')
      if (fVara !== '—') return fVara
    }
  }

  return '—'
}

export function getProcessData(proc: any): string {
  if (!proc) return '—'
  const d = getNestedField(
    proc,
    'data_ajuizamento',
    'data_distribuicao',
    'data_inicio',
    'capa.data_ajuizamento',
    'capa.data_distribuicao',
    'data',
    'fontes.0.data_ajuizamento',
    'fontes.0.data_distribuicao',
    'fontes.0.data_inicio',
  )
  if (d === '—') return '—'

  if (d.includes('T') || d.match(/^\d{4}-\d{2}-\d{2}/)) {
    try {
      const [datePart] = d.split('T')
      const [yyyy, mm, dd] = datePart.split('-')
      if (yyyy && mm && dd) return `${dd}/${mm}/${yyyy}`
    } catch {
      /* noop */
    }
  }
  return d
}

export function getProcessLink(proc: any): string | null {
  if (!proc) return null

  const directUrl = getNestedField(
    proc,
    'url',
    'link',
    'link_escavador',
    'escavador_url',
    'url_escavador',
    'capa.link',
    'capa.url',
    'fontes.0.url',
    'fontes.0.link',
  )
  if (directUrl !== '—' && directUrl.startsWith('http')) {
    return directUrl
  }

  const num = getProcessNumber(proc)
  if (num && num !== '—') {
    const trimmedNum = num.trim()
    const digitsOnly = trimmedNum.replace(/[^\d]/g, '')

    if (digitsOnly.length === 20) {
      if (trimmedNum.includes('-') || trimmedNum.includes('.')) {
        return `https://www.escavador.com/processos/${trimmedNum}`
      }
      const formatted = `${digitsOnly.slice(0, 7)}-${digitsOnly.slice(7, 9)}.${digitsOnly.slice(9, 13)}.${digitsOnly.slice(13, 14)}.${digitsOnly.slice(14, 16)}.${digitsOnly.slice(16, 20)}`
      return `https://www.escavador.com/processos/${formatted}`
    }

    return `https://www.escavador.com/busca?q=${encodeURIComponent(trimmedNum)}`
  }

  return null
}

export function getTopAssuntos(processos: any[]): { label: string; count: number }[] {
  if (!Array.isArray(processos)) return []
  const counts: Record<string, number> = {}

  processos.forEach((p) => {
    const assunto = getProcessAssunto(p)
    if (assunto && assunto !== '—') {
      const parts = assunto
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      parts.forEach((text) => {
        counts[text] = (counts[text] || 0) + 1
      })
    }

    const classe = getProcessClass(p)
    if (classe && classe !== '—') {
      counts[classe] = (counts[classe] || 0) + 1
    }
  })

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }))
}

export function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleString('pt-BR', {
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
