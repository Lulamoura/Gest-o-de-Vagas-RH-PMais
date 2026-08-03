routerAdd('GET', '/backend/v1/candidate-public-data/{id}', (e) => {
  var id = e.request.pathValue('id')

  try {
    var candidate = $app.findRecordById('candidates', id)

    var vacancyName = 'Vaga PMais'
    var vacancyId = candidate.getString('vacancy_id')
    if (vacancyId) {
      try {
        var vacancy = $app.findRecordById('vacancies', vacancyId)
        var cargoId = vacancy.getString('cargo')
        if (cargoId) {
          try {
            vacancyName = $app.findRecordById('cargos', cargoId).getString('nome')
          } catch (_) {}
        }
      } catch (_) {}
    }

    return e.json(200, {
      nome: candidate.getString('nome'),
      email: candidate.getString('email'),
      vacancy_title: vacancyName,
      rg: candidate.getString('rg'),
      tamanho_fardamento: candidate.getString('tamanho_fardamento'),
      tamanho_sapato: candidate.getString('tamanho_sapato'),
      vale_transporte_qtd: candidate.getInt('vale_transporte_qtd'),
      nome_pai: candidate.getString('nome_pai'),
      nome_mae: candidate.getString('nome_mae'),
      telefone_emergencia: candidate.getString('telefone_emergencia'),
      valor_unitario_transporte: candidate.getFloat('valor_unitario_transporte'),
      data_nascimento: candidate.getString('data_nascimento'),
    })
  } catch (err) {
    return e.json(404, { error: 'Candidato não encontrado' })
  }
})
