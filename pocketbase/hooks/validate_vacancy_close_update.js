onRecordUpdate((e) => {
  var record = e.record
  var newStatus = record.getString('status_vaga')
  var oldStatus = ''

  try {
    oldStatus = record.original().getString('status_vaga')
  } catch (_) {
    e.next()
    return
  }

  if (newStatus !== 'Concluída' || oldStatus === 'Concluída') {
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

  if (integradoCandidates.length !== quantidadeVagas) {
    throw new BadRequestError(
      'O número de candidatos integrados deve ser igual à quantidade de vagas para fechar a vaga.',
    )
  }

  e.next()
}, 'vacancies')
