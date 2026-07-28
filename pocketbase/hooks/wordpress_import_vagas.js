routerAdd('POST', '/backend/v1/vagas/wordpress', (e) => {
  var authHeader = e.request.header.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) {
    return e.json(401, { ok: false, message: 'Acesso não autorizado' })
  }
  var token = authHeader.slice(7).trim()
  var expectedToken = $secrets.get('WORDPRESS_INTEGRATION_TOKEN') || ''
  if (!expectedToken || token !== expectedToken) {
    return e.json(401, { ok: false, message: 'Acesso não autorizado' })
  }

  var body = e.requestInfo().body || {}
  var jobId = body.wordpress_job_id || ''
  var origem = body.origem || 'wordpress'

  if (!jobId) {
    return e.badRequestError('wordpress_job_id é obrigatório')
  }

  var writeLog = function (wpJobId, status, mensagem) {
    try {
      var logsCol = $app.findCollectionByNameOrId('wordpress_import_logs')
      var log = new Record(logsCol)
      log.set('wordpress_job_id', wpJobId)
      log.set('origem', origem)
      log.set('status', status)
      log.set('mensagem', mensagem)
      $app.save(log)
    } catch (_) {}
  }

  var findOrCreateRef = function (collectionName, nome) {
    if (!nome || String(nome).trim() === '') return ''
    var trimmed = String(nome).trim()
    try {
      var existing = $app.findFirstRecordByFilter(collectionName, 'nome = {:nome}', trimmed)
      return existing.id
    } catch (_) {}
    try {
      var col = $app.findCollectionByNameOrId(collectionName)
      var rec = new Record(col)
      rec.set('nome', trimmed)
      $app.save(rec)
      return rec.id
    } catch (_) {
      return ''
    }
  }

  var setVacancyFields = function (vacancy, isUpdate) {
    if (body.quantidade !== undefined && body.quantidade !== null) {
      var qtd = parseInt(body.quantidade, 10)
      if (!isNaN(qtd) && qtd > 0) {
        vacancy.set('quantidade_vagas', qtd)
      }
    } else if (!isUpdate && body.quantidade_vagas !== undefined && body.quantidade_vagas !== null) {
      vacancy.set('quantidade_vagas', body.quantidade_vagas)
    }

    if (body.data_publicacao) {
      try {
        var d = new Date(body.data_publicacao)
        if (!isNaN(d.getTime())) {
          vacancy.set('data_abertura', d.toISOString().split('T')[0])
        }
      } catch (_) {}
    } else if (body.data_abertura) {
      vacancy.set('data_abertura', body.data_abertura)
    }

    if (body.titulo) {
      var cargoId = findOrCreateRef('cargos', body.titulo)
      if (cargoId) vacancy.set('cargo', cargoId)
    }

    if (body.localizacao) {
      var cidadeId = findOrCreateRef('cidades', body.localizacao)
      if (cidadeId) vacancy.set('cidade', cidadeId)
    }

    if (body.tipo_contrato) {
      var tipoContratoId = findOrCreateRef('tipos_contrato', body.tipo_contrato)
      if (tipoContratoId) vacancy.set('tipo_contrato', tipoContratoId)
    }

    if (body.empresa) {
      var clienteId = findOrCreateRef('clientes', body.empresa)
      if (clienteId) vacancy.set('cliente', clienteId)
    } else if (body.cliente) {
      var clienteId2 = findOrCreateRef('clientes', body.cliente)
      if (clienteId2) vacancy.set('cliente', clienteId2)
    }

    if (body.link_publico) {
      vacancy.set('link_publico', String(body.link_publico))
    }
    if (body.descricao) {
      vacancy.set('especificacoes', String(body.descricao))
    }
    if (body.perfil_interno) {
      vacancy.set('perfil_interno', String(body.perfil_interno))
    }
    if (body.origem) {
      vacancy.set('origem', String(body.origem))
    }

    if (body.responsavel_operacional) {
      vacancy.set('responsavel_operacional', String(body.responsavel_operacional))
    }
    if (body.salario_faixa) {
      vacancy.set('salario_faixa', String(body.salario_faixa))
    }
    if (body.observacoes_internas) {
      vacancy.set('observacoes_internas', String(body.observacoes_internas))
    }

    if (!isUpdate) {
      vacancy.set('wordpress_job_id', jobId)
      vacancy.set('status_vaga', 'Aberta')
      vacancy.set('prioridade', 'Média')
      vacancy.set('origem', body.origem || 'wordpress')
    }
  }

  var existingVacancy = null
  try {
    existingVacancy = $app.findFirstRecordByData('vacancies', 'wordpress_job_id', jobId)
  } catch (_) {}

  if (existingVacancy) {
    try {
      setVacancyFields(existingVacancy, true)
      $app.save(existingVacancy)
      writeLog(jobId, 'sucesso', 'Vaga atualizada via importação WordPress (idempotente)')
      return e.json(200, { ok: true, duplicate: true, vaga_id: existingVacancy.id })
    } catch (err) {
      writeLog(jobId, 'erro', 'Erro ao atualizar vaga existente: ' + (err.message || ''))
      return e.json(500, { ok: false, status: 'erro', message: err.message })
    }
  }

  try {
    var vacanciesCol = $app.findCollectionByNameOrId('vacancies')
    var vacancy = new Record(vacanciesCol)
    setVacancyFields(vacancy, false)
    $app.save(vacancy)

    writeLog(jobId, 'sucesso', 'Vaga importada com sucesso')
    return e.json(200, { ok: true, status: 'sucesso', vaga_id: vacancy.id, vacancy: vacancy.id })
  } catch (err) {
    writeLog(jobId, 'erro', err.message || 'Erro ao importar vaga')
    return e.json(500, { ok: false, status: 'erro', message: err.message })
  }
})
