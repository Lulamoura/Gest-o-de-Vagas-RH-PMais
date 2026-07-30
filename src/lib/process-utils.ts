import { getField, getNestedField } from '@/lib/legal-utils'

export interface Party {
  nome: string
  tipo: string
  categoria?: string
}

export interface Movement {
  data: string
  descricao: string
}

export function parseParties(data: any): Party[] {
  if (!data || typeof data !== 'object') return []
  const parties: Party[] = []
  const seen = new Set<string>()

  const addParty = (p: any, defaultPolo?: string) => {
    if (!p || typeof p !== 'object') return
    const nome = getField(
      p,
      'nome',
      'razao_social',
      'nome_completo',
      'nome_normalizado',
      'nome_parte',
    )
    if (!nome || nome === '—') return
    let tipo = getField(
      p,
      'tipo',
      'tipo_parte',
      'tipo_normalizado',
      'qualificacao',
      'polo',
      'categoria',
      'relacao',
      'papel',
    )
    if (tipo === '—' && defaultPolo) tipo = defaultPolo
    const categoria = getNestedField(
      p,
      'pessoa.tipo',
      'pessoa.categoria',
      'oab',
      'oab_uf',
      'advogado',
      'oab_numero',
    )
    const key = `${nome.toLowerCase().trim()}_${tipo.toLowerCase().trim()}`
    if (!seen.has(key)) {
      seen.add(key)
      parties.push({ nome, tipo, categoria: categoria !== '—' ? categoria : undefined })
    }
    if (Array.isArray(p.advogados)) {
      p.advogados.forEach((adv: any) => {
        if (!adv || typeof adv !== 'object') return
        const advNome = getField(adv, 'nome', 'nome_completo', 'razao_social')
        if (!advNome || advNome === '—') return
        const advOab = getField(adv, 'oab', 'oab_numero', 'oab_uf')
        const advKey = `${advNome.toLowerCase().trim()}_advogado`
        if (!seen.has(advKey)) {
          seen.add(advKey)
          parties.push({
            nome: advNome,
            tipo: 'Advogado',
            categoria: advOab !== '—' ? `OAB: ${advOab}` : undefined,
          })
        }
      })
    }
  }

  const parseList = (list: any) => {
    if (Array.isArray(list)) list.forEach((p) => addParty(p))
  }
  parseList(data.partes)
  parseList(data.envolvidos)
  parseList(data.capa?.partes)
  parseList(data.capa?.envolvidos)
  if (Array.isArray(data.polos)) {
    data.polos.forEach((poloObj: any) => {
      if (!poloObj) return
      const poloTipo = poloObj.tipo || poloObj.polo || 'Parte'
      if (Array.isArray(poloObj.partes)) poloObj.partes.forEach((p: any) => addParty(p, poloTipo))
    })
  }
  if (Array.isArray(data.fontes)) {
    for (const f of data.fontes) {
      if (!f) continue
      parseList(f.envolvidos)
      parseList(f.partes)
      parseList(f.capa?.partes)
      parseList(f.capa?.envolvidos)
    }
  }
  return parties
}

export function parseMovements(data: any): Movement[] {
  if (!data || typeof data !== 'object') return []
  const movements: Movement[] = []
  const seen = new Set<string>()

  const addMov = (m: any) => {
    if (!m || typeof m !== 'object') return
    const dt =
      getField(m, 'data', 'data_movimento', 'data_hora', 'data_andamento', 'data_publicacao') || '—'
    const desc = getField(
      m,
      'descricao',
      'nome',
      'titulo',
      'complemento',
      'conteudo',
      'texto',
      'resumo',
    )
    if (!desc || desc === '—') return
    const key = `${dt}_${desc}`
    if (seen.has(key)) return
    seen.add(key)
    movements.push({ data: dt, descricao: desc })
  }

  const parseList = (list: any) => {
    if (Array.isArray(list)) list.forEach(addMov)
  }
  parseList(data.movimentacoes)
  parseList(data.movimentos)
  parseList(data.andamentos)
  parseList(data.ultimas_movimentacoes)
  if (Array.isArray(data.fontes)) {
    for (const f of data.fontes) {
      if (!f) continue
      parseList(f.movimentacoes)
      parseList(f.movimentos)
      parseList(f.andamentos)
    }
  }
  return movements
}
