routerAdd(
  'POST',
  '/backend/v1/vagas/wordpress',
  (e) => {
    const body = e.requestInfo().body || {}
    const jobId = body.wordpress_job_id || ''
    const origem = body.origem || 'manual'

    if (!jobId) {
      return e.badRequestError('wordpress_job_id é obrigatório')
    }

    try {
      const existing = $app.findFirstRecordByFilter(
        'vacancies',
        'wordpress_job_id = {:jobId}',
        jobId,
      )
      const logsCol = $app.findCollectionByNameOrId('wordpress_import_logs')
      const log = new Record(logsCol)
      log.set('wordpress_job_id', jobId)
      log.set('origem', origem)
      log.set('status', 'duplicada')
      log.set('mensagem', 'Vaga com este wordpress_job_id já existe')
      $app.save(log)
      return e.json(200, { status: 'duplicada', message: 'Vaga já importada' })
    } catch (_) {}

    try {
      const vacanciesCol = $app.findCollectionByNameOrId('vacancies')
      const vacancy = new Record(vacanciesCol)
      vacancy.set('wordpress_job_id', jobId)
      vacancy.set('status_vaga', 'Aberta')
      vacancy.set('prioridade', 'Média')
      vacancy.set('quantidade_vagas', body.quantidade_vagas || 1)
      vacancy.set('responsavel_operacional', body.responsavel_operacional || '')
      vacancy.set('salario_faixa', body.salario_faixa || '')
      vacancy.set('especificacoes', body.especificacoes || '')
      vacancy.set('observacoes_internas', body.observacoes_internas || '')

      if (body.cliente) {
        try {
          const cliente = $app.findFirstRecordByFilter('clientes', 'nome = {:nome}', body.cliente)
          vacancy.set('cliente', cliente.id)
        } catch (_) {}
      }
      if (body.cargo) {
        try {
          const cargo = $app.findFirstRecordByFilter('cargos', 'nome = {:nome}', body.cargo)
          vacancy.set('cargo', cargo.id)
        } catch (_) {}
      }
      if (body.cidade) {
        try {
          const cidade = $app.findFirstRecordByFilter('cidades', 'nome = {:nome}', body.cidade)
          vacancy.set('cidade', cidade.id)
        } catch (_) {}
      }

      $app.save(vacancy)

      const logsCol = $app.findCollectionByNameOrId('wordpress_import_logs')
      const log = new Record(logsCol)
      log.set('wordpress_job_id', jobId)
      log.set('origem', origem)
      log.set('status', 'sucesso')
      log.set('mensagem', 'Vaga importada com sucesso')
      $app.save(log)

      return e.json(200, { status: 'sucesso', vacancy: vacancy.id })
    } catch (err) {
      const logsCol = $app.findCollectionByNameOrId('wordpress_import_logs')
      const log = new Record(logsCol)
      log.set('wordpress_job_id', jobId)
      log.set('origem', origem)
      log.set('status', 'erro')
      log.set('mensagem', err.message || 'Erro ao importar vaga')
      $app.save(log)
      return e.json(500, { status: 'erro', message: err.message })
    }
  },
  $apis.requireAuth(),
)
