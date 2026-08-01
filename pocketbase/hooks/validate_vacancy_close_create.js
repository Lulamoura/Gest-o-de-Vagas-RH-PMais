onRecordCreate((e) => {
  var record = e.record
  var newStatus = record.getString('status_vaga')

  if (newStatus !== 'Concluída') {
    e.next()
    return
  }

  var quantidadeVagas = record.getInt('quantidade_vagas')
  if (!quantidadeVagas || quantidadeVagas < 1) {
    throw new BadRequestError('A quantidade de vagas deve ser maior que zero para fechar a vaga.')
  }

  var integradoCandidates = $app.findRecordsByFilter(
    'candidates',
    "vacancy_id = '" + record.id + "' && status_candidato = 'Integrado'",
    '',
    0,
    0,
  )

  if (integradoCandidates.length < quantidadeVagas) {
    throw new BadRequestError(
      'A vaga não pode ser concluída até que todas as posições sejam preenchidas. O número de candidatos integrados deve ser igual ou superior à quantidade de vagas.',
    )
  }

  e.next()
}, 'vacancies')
