routerAdd('POST', '/backend/v1/candidate-public-data/{id}', (e) => {
  const id = e.request.pathValue('id')
  const body = e.requestInfo().body || {}

  try {
    const candidate = $app.findRecordById('candidates', id)

    if (body.rg !== undefined) candidate.set('rg', body.rg)
    if (body.tamanho_fardamento !== undefined)
      candidate.set('tamanho_fardamento', body.tamanho_fardamento)
    if (body.tamanho_sapato !== undefined) candidate.set('tamanho_sapato', body.tamanho_sapato)
    if (body.vale_transporte_qtd !== undefined)
      candidate.set('vale_transporte_qtd', body.vale_transporte_qtd)
    if (body.nome_pai !== undefined) candidate.set('nome_pai', body.nome_pai)
    if (body.nome_mae !== undefined) candidate.set('nome_mae', body.nome_mae)
    if (body.telefone_emergencia !== undefined)
      candidate.set('telefone_emergencia', body.telefone_emergencia)
    if (body.valor_unitario_transporte !== undefined)
      candidate.set('valor_unitario_transporte', body.valor_unitario_transporte)
    if (body.data_nascimento !== undefined) candidate.set('data_nascimento', body.data_nascimento)

    $app.save(candidate)
    return e.json(200, { success: true })
  } catch (err) {
    return e.json(400, {
      error: 'Erro ao atualizar dados: ' + (err.message || 'erro desconhecido'),
    })
  }
})
