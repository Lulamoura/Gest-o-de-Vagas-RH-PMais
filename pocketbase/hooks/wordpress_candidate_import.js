routerAdd('POST', '/backend/v1/candidatos/wordpress', (e) => {
  var writeLog = function (jobId, status, mensagem) {
    try {
      var logsCol = $app.findCollectionByNameOrId('wordpress_import_logs')
      var log = new Record(logsCol)
      log.set('wordpress_job_id', jobId || '')
      log.set('origem', 'wordpress')
      log.set('status', status)
      log.set('mensagem', mensagem)
      $app.save(log)
    } catch (logErr) {
      try {
        $app
          .logger()
          .error(
            'wordpress_candidate_import: failed to write import log',
            'jobId',
            jobId || '',
            'error',
            logErr.message || String(logErr),
          )
      } catch (_) {}
    }
  }

  try {
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
    var wordpressCandidaturaId = body.wordpress_candidatura_id
      ? String(body.wordpress_candidatura_id).trim()
      : ''

    var vacancyId = ''
    var vacancyRecord = null
    var requestedSkipVacancyId = body.skip_vaga_id ? String(body.skip_vaga_id).trim() : ''
    var requestedWordpressVacancyId = body.wordpress_vaga_id
      ? String(body.wordpress_vaga_id).trim()
      : ''

    if (!requestedSkipVacancyId && !requestedWordpressVacancyId) {
      return e.json(400, {
        ok: false,
        message: 'Campos obrigatórios ausentes',
        campos: ['skip_vaga_id', 'wordpress_vaga_id'],
      })
    }

    if (requestedSkipVacancyId) {
      vacancyId = requestedSkipVacancyId
      try {
        vacancyRecord = $app.findRecordById('vacancies', vacancyId)
      } catch (vacErr) {
        writeLog(wordpressCandidaturaId, 'erro', 'Vaga não encontrada no SKIP (skip_vaga_id)')
        return e.json(404, {
          ok: false,
          message: 'Vaga não encontrada no SKIP',
          skip_vaga_id: vacancyId,
        })
      }
    }

    if (requestedWordpressVacancyId) {
      var vacancyByWordpressId = null
      try {
        vacancyByWordpressId = $app.findFirstRecordByFilter(
          'vacancies',
          'wordpress_job_id = {:jobId}',
          requestedWordpressVacancyId,
        )
      } catch (vacErr2) {
        writeLog(requestedWordpressVacancyId, 'erro', 'Vaga não encontrada no SKIP')
        return e.json(404, {
          ok: false,
          message: 'Vaga não encontrada no SKIP',
          wordpress_vaga_id: requestedWordpressVacancyId,
        })
      }
      if (vacancyRecord && vacancyRecord.id !== vacancyByWordpressId.id) {
        writeLog(
          wordpressCandidaturaId,
          'erro',
          'Identificadores de vaga apontam para destinos diferentes',
        )
        return e.json(409, {
          ok: false,
          code: 'pmais_gv_vacancy_conflict',
          message: 'Os identificadores informados apontam para vagas diferentes.',
        })
      }
      vacancyRecord = vacancyByWordpressId
      vacancyId = vacancyByWordpressId.id
    }

    var buildVacancySummary = function (app, record) {
      var relationName = function (collection, relationId) {
        if (!relationId) return ''
        try {
          return app.findRecordById(collection, relationId).getString('nome').trim()
        } catch (_) {
          return ''
        }
      }
      var status = record ? record.getString('status_vaga').trim() : ''
      return {
        id: record ? record.id : '',
        cliente: record ? relationName('clientes', record.getString('cliente')) : '',
        cargo: record ? relationName('cargos', record.getString('cargo')) : '',
        ordem_execucao: record ? record.getString('ordem_execucao').trim() : '',
        status_vaga: status,
        requires_confirmation: status !== 'Aberta',
      }
    }
    var vacancySummary = buildVacancySummary($app, vacancyRecord)
    if (
      !vacancySummary.id ||
      !vacancySummary.cliente ||
      !vacancySummary.cargo ||
      !vacancySummary.ordem_execucao ||
      !vacancySummary.status_vaga
    ) {
      writeLog(wordpressCandidaturaId, 'erro', 'Destino da vaga incompleto no GV')
      return e.json(422, {
        ok: false,
        code: 'pmais_gv_vacancy_destination_incomplete',
        message: 'O destino da vaga está incompleto no GV.',
      })
    }

    if (body.preflight === true) {
      return e.json(200, {
        ok: true,
        preflight: true,
        vacancy: vacancySummary,
      })
    }

    var requiredFields = ['wordpress_candidatura_id', 'nome', 'email', 'telefone', 'cpf']
    var missing = []
    for (var i = 0; i < requiredFields.length; i++) {
      var field = requiredFields[i]
      var val = body[field]
      if (val === undefined || val === null || String(val).trim() === '') {
        missing.push(field)
      }
    }
    if (missing.length > 0) {
      return e.json(400, {
        ok: false,
        message: 'Campos obrigatórios ausentes',
        campos: missing,
      })
    }

    wordpressCandidaturaId = String(body.wordpress_candidatura_id).trim()
    var nome = String(body.nome).trim()
    var email = String(body.email).trim()
    var telefone = String(body.telefone).trim()
    var cpf = String(body.cpf).trim()
    var bairro = body.bairro ? String(body.bairro).trim() : ''
    var cidade = body.cidade ? String(body.cidade).trim() : ''
    var ranking = body.ranking || body.ranking === 0 ? Number(body.ranking) : null
    var requestedClosedVacancyOverride = body.confirm_closed_vacancy === true
    var confirmedClosedVacancy =
      vacancySummary.requires_confirmation && requestedClosedVacancyOverride
    var overrideReason = body.closed_vacancy_override_reason
      ? String(body.closed_vacancy_override_reason).trim().slice(0, 500)
      : ''
    var overrideActorId = body.override_actor_id
      ? String(body.override_actor_id).trim().slice(0, 100)
      : ''
    var overrideActorLogin = body.override_actor_login
      ? String(body.override_actor_login).trim().slice(0, 100)
      : ''

    if (vacancySummary.requires_confirmation && !confirmedClosedVacancy) {
      writeLog(wordpressCandidaturaId, 'erro', 'Envio bloqueado: vaga não está aberta no GV')
      return e.json(409, {
        ok: false,
        code: 'pmais_gv_vacancy_closed',
        message: 'Vaga já encerrada no GV. Confirme o envio excepcional.',
        vacancy: vacancySummary,
      })
    }

    if (
      vacancySummary.requires_confirmation &&
      confirmedClosedVacancy &&
      (!overrideReason || !overrideActorId || !overrideActorLogin)
    ) {
      writeLog(
        wordpressCandidaturaId,
        'erro',
        'Override de vaga não aberta rejeitado: auditoria administrativa incompleta',
      )
      return e.json(400, {
        ok: false,
        code: 'pmais_gv_closed_vacancy_override_invalid',
        message: 'Confirmação administrativa, responsável e motivo são obrigatórios.',
        vacancy: vacancySummary,
      })
    }

    if (confirmedClosedVacancy) {
      var suppliedOverrideToken = e.request.header.get('X-PMais-Override-Token') || ''
      var expectedOverrideToken = $secrets.get('WORDPRESS_CLOSED_VACANCY_OVERRIDE_TOKEN') || ''
      if (
        !expectedOverrideToken ||
        expectedOverrideToken === expectedToken ||
        suppliedOverrideToken !== expectedOverrideToken
      ) {
        writeLog(
          wordpressCandidaturaId,
          'erro',
          'Override de vaga não aberta rejeitado: autorização administrativa inválida',
        )
        return e.json(403, {
          ok: false,
          code: 'pmais_gv_closed_vacancy_override_unauthorized',
          message: 'Autorização administrativa inválida.',
          vacancy: vacancySummary,
        })
      }
      var expectedOverrideActorId = (
        $secrets.get('WORDPRESS_CLOSED_VACANCY_OVERRIDE_ACTOR_ID') || ''
      ).trim()
      var expectedOverrideActorLogin = (
        $secrets.get('WORDPRESS_CLOSED_VACANCY_OVERRIDE_ACTOR_LOGIN') || ''
      ).trim()
      if (
        !expectedOverrideActorId ||
        !expectedOverrideActorLogin ||
        overrideActorId !== expectedOverrideActorId ||
        overrideActorLogin !== expectedOverrideActorLogin
      ) {
        writeLog(
          wordpressCandidaturaId,
          'erro',
          'Override de vaga não aberta rejeitado: ator não corresponde à credencial',
        )
        return e.json(403, {
          ok: false,
          code: 'pmais_gv_closed_vacancy_override_actor_invalid',
          message: 'O administrador informado não corresponde à credencial de override.',
          vacancy: vacancySummary,
        })
      }
    }

    var transactionResult = { kind: 'error' }
    try {
      $app.runInTransaction((txApp) => {
        var currentVacancy = txApp.findRecordById('vacancies', vacancyId)
        var currentSummary = buildVacancySummary(txApp, currentVacancy)
        if (
          !currentSummary.id ||
          !currentSummary.cliente ||
          !currentSummary.cargo ||
          !currentSummary.ordem_execucao ||
          !currentSummary.status_vaga
        ) {
          throw new Error('Destino da vaga incompleto no GV')
        }

        var existingByCandidatura = txApp.findRecordsByFilter(
          'candidates',
          'wordpress_candidatura_id = {:cid}',
          '',
          1,
          0,
          { cid: wordpressCandidaturaId },
        )
        if (existingByCandidatura.length > 0) {
          transactionResult = {
            kind: 'duplicate_application',
            candidateId: existingByCandidatura[0].id,
          }
          return
        }

        var existingByEmailCpfVaga = txApp.findRecordsByFilter(
          'candidates',
          'email = {:email} && cpf = {:cpf} && vacancy_id = {:vid}',
          '',
          1,
          0,
          { email: email, cpf: cpf, vid: vacancyId },
        )
        if (existingByEmailCpfVaga.length > 0) {
          transactionResult = { kind: 'duplicate_identity' }
          return
        }

        if (currentSummary.requires_confirmation && !confirmedClosedVacancy) {
          transactionResult = { kind: 'closed', vacancy: currentSummary }
          return
        }

        var finalOverride = currentSummary.requires_confirmation && confirmedClosedVacancy
        var candidate = new Record(txApp.findCollectionByNameOrId('candidates'))
        candidate.set('vacancy_id', vacancyId)
        candidate.set('nome', nome)
        candidate.set('email', email)
        candidate.set('telefone', telefone)
        candidate.set('cpf', cpf)
        candidate.set('bairro', bairro)
        candidate.set('cidade', cidade)
        if (ranking !== null && !isNaN(ranking)) candidate.set('rank', ranking)
        candidate.set('wordpress_candidatura_id', wordpressCandidaturaId)
        candidate.set('status_candidato', 'Análise do RH')
        candidate.set('ordem_execucao', currentVacancy.getString('ordem_execucao'))
        var currentTipoVaga = currentVacancy.getString('tipo_vaga')
        var currentTipoContrato = currentVacancy.getString('tipo_contrato')
        if (currentTipoVaga) candidate.set('tipo_vaga', currentTipoVaga)
        if (currentTipoContrato) candidate.set('tipo_contrato', currentTipoContrato)
        txApp.save(candidate)

        var safeActorId = overrideActorId.replace(/[\r\n\t;]/g, ' ')
        var safeActorLogin = overrideActorLogin.replace(/[\r\n\t;]/g, ' ')
        var safeReason = overrideReason.replace(/[\r\n\t;]/g, ' ')
        var successMessage = 'Candidato criado no SKIP'
        if (finalOverride) {
          successMessage =
            'Override administrativo de vaga não aberta; ator=' +
            safeActorLogin +
            ' (' +
            safeActorId +
            '); vaga_id=' +
            currentSummary.id +
            '; destino=' +
            currentSummary.cliente +
            ' | ' +
            currentSummary.cargo +
            ' | OE ' +
            currentSummary.ordem_execucao +
            ' | ' +
            currentSummary.status_vaga +
            '; motivo=' +
            safeReason
        }
        var auditLog = new Record(txApp.findCollectionByNameOrId('wordpress_import_logs'))
        auditLog.set('wordpress_job_id', wordpressCandidaturaId)
        auditLog.set('origem', 'wordpress')
        auditLog.set('status', 'sucesso')
        auditLog.set('mensagem', successMessage)
        txApp.save(auditLog)

        transactionResult = {
          kind: 'created',
          candidateId: candidate.id,
          override: finalOverride,
        }
      })
    } catch (saveErr) {
      var errMsg = saveErr.message || 'Erro de validação ao criar candidato'
      writeLog(wordpressCandidaturaId, 'erro', errMsg)
      return e.json(400, { ok: false, message: errMsg })
    }

    if (transactionResult.kind === 'duplicate_application') {
      writeLog(wordpressCandidaturaId, 'duplicada', 'Candidatura já importada')
      return e.json(409, {
        ok: false,
        duplicate: true,
        message: 'Candidatura já importada',
        wordpress_candidatura_id: wordpressCandidaturaId,
        candidato_id: transactionResult.candidateId,
      })
    }
    if (transactionResult.kind === 'duplicate_identity') {
      writeLog(wordpressCandidaturaId, 'duplicada', 'Candidato já cadastrado para esta vaga')
      return e.json(409, {
        ok: false,
        duplicate: true,
        message: 'Candidato já cadastrado para esta vaga',
      })
    }
    if (transactionResult.kind === 'closed') {
      writeLog(
        wordpressCandidaturaId,
        'erro',
        'Envio bloqueado após releitura: vaga não está aberta no GV',
      )
      return e.json(409, {
        ok: false,
        code: 'pmais_gv_vacancy_closed',
        message: 'Vaga já encerrada no GV. Confirme o envio excepcional.',
        vacancy: transactionResult.vacancy,
      })
    }
    if (transactionResult.kind !== 'created') {
      throw new Error('Resultado transacional inválido')
    }

    return e.json(201, {
      ok: true,
      message: 'Candidato criado no SKIP',
      candidato_id: transactionResult.candidateId,
      vaga_id: vacancyId,
      closed_vacancy_override: transactionResult.override,
    })
  } catch (err) {
    try {
      $app.logger().error('wordpress_candidate_import error', 'error', err.message || String(err))
    } catch (_) {}
    var bodyForLog = e.requestInfo().body || {}
    writeLog(
      bodyForLog.wordpress_candidatura_id || '',
      'erro',
      err.message || 'Erro interno do servidor',
    )
    return e.json(500, { ok: false, message: 'Erro interno do servidor' })
  }
})
