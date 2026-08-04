routerAdd('POST', '/backend/v1/candidate-public-data/{id}', (e) => {
  const id = e.request.pathValue('id')
  if (!id) return e.badRequestError('ID é obrigatório')

  const body = e.requestInfo().body || {}

  let candidate
  try {
    candidate = $app.findRecordById('candidates', id)
  } catch (_) {
    return e.notFoundError('Candidato não encontrado')
  }

  candidate.set('rg', body.rg || '')
  if (body.tamanho_fardamento) {
    candidate.set('tamanho_fardamento', body.tamanho_fardamento)
  }
  candidate.set('tamanho_sapato', body.tamanho_sapato || '')
  candidate.set('vale_transporte_qtd', Number(body.vale_transporte_qtd) || 0)
  candidate.set('nome_pai', body.nome_pai || '')
  candidate.set('nome_mae', body.nome_mae || '')
  candidate.set('telefone_emergencia', body.telefone_emergencia || '')
  candidate.set('data_nascimento', body.data_nascimento || '')
  candidate.set('valor_unitario_transporte', Number(body.valor_unitario_transporte) || 0)

  $app.save(candidate)

  return e.json(200, { success: true })
})
