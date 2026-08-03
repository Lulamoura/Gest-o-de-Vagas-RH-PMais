routerAdd('GET', '/backend/v1/candidate-public-data/{id}', (e) => {
  const id = e.request.pathValue('id')
  if (!id) {
    return e.badRequestError('ID do candidato é obrigatório')
  }
  try {
    const candidate = $app.findRecordById('candidates', id)
    const vacancyId = candidate.getString('vacancy_id')

    let vacancyTitle = '—'
    if (vacancyId) {
      try {
        const vacancy = $app.findRecordById('vacancies', vacancyId)
        const cargoId = vacancy.getString('cargo')
        if (cargoId) {
          try {
            const cargo = $app.findRecordById('cargos', cargoId)
            vacancyTitle = cargo.getString('nome')
          } catch (_) {}
        }
      } catch (_) {}
    }

    return e.json(200, {
      nome: candidate.getString('nome'),
      email: candidate.getString('email'),
      vacancy_title: vacancyTitle,
      rg: candidate.getString('rg'),
      tamanho_fardamento: candidate.getString('tamanho_fardamento'),
      tamanho_sapato: candidate.getString('tamanho_sapato'),
      vale_transporte_qtd: candidate.get('vale_transporte_qtd') || 0,
      nome_pai: candidate.getString('nome_pai'),
      nome_mae: candidate.getString('nome_mae'),
      telefone_emergencia: candidate.getString('telefone_emergencia'),
      valor_unitario_transporte: candidate.get('valor_unitario_transporte') || 0,
      data_nascimento: candidate.getString('data_nascimento'),
    })
  } catch (err) {
    return e.notFoundError('Candidato não encontrado')
  }
})
