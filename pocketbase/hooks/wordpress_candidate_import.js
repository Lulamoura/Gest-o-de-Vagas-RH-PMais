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

    var wordpressCandidaturaId = String(body.wordpress_candidatura_id).trim()
    var nome = String(body.nome).trim()
    var email = String(body.email).trim()
    var telefone = String(body.telefone).trim()
    var cpf = String(body.cpf).trim()
    var bairro = body.bairro ? String(body.bairro).trim() : ''
    var cidade = body.cidade ? String(body.cidade).trim() : ''
    var ranking = body.ranking || body.ranking === 0 ? Number(body.ranking) : null

    var vacancyId = ''
    var vacancyRecord = null

    if (body.skip_vaga_id && String(body.skip_vaga_id).trim() !== '') {
      vacancyId = String(body.skip_vaga_id).trim()
      try {
        vacancyRecord = $app.findRecordById('vacancies', vacancyId)
      } catch (vacErr) {
        $app
          .logger()
          .error(
            'wordpress_candidate_import: vacancy lookup failed via skip_vaga_id',
            'vacancyId',
            vacancyId,
            'error',
            vacErr.message || String(vacErr),
          )
        writeLog(wordpressCandidaturaId, 'erro', 'Vaga não encontrada no SKIP (skip_vaga_id)')
        return e.json(404, {
          ok: false,
          message: 'Vaga não encontrada no SKIP',
          skip_vaga_id: vacancyId,
        })
      }
    } else if (body.wordpress_vaga_id && String(body.wordpress_vaga_id).trim() !== '') {
      var wordpressVagaId = String(body.wordpress_vaga_id).trim()
      try {
        vacancyRecord = $app.findFirstRecordByFilter(
          'vacancies',
          'wordpress_job_id = {:jobId}',
          wordpressVagaId,
        )
        vacancyId = vacancyRecord.id
      } catch (vacErr2) {
        $app
          .logger()
          .error(
            'wordpress_candidate_import: vacancy lookup failed via wordpress_vaga_id',
            'wordpressVagaId',
            wordpressVagaId,
            'error',
            vacErr2.message || String(vacErr2),
          )
        writeLog(wordpressVagaId, 'erro', 'Vaga não encontrada no SKIP')
        return e.json(404, {
          ok: false,
          message: 'Vaga não encontrada no SKIP',
          wordpress_vaga_id: wordpressVagaId,
        })
      }
    } else {
      return e.json(400, {
        ok: false,
        message: 'Campos obrigatórios ausentes',
        campos: ['skip_vaga_id', 'wordpress_vaga_id'],
      })
    }

    try {
      var existingByCandidatura = $app.findFirstRecordByFilter(
        'candidates',
        'wordpress_candidatura_id = {:cid}',
        wordpressCandidaturaId,
      )
      writeLog(wordpressCandidaturaId, 'duplicada', 'Candidatura já importada')
      return e.json(409, {
        ok: false,
        message: 'Candidatura já importada',
        wordpress_candidatura_id: wordpressCandidaturaId,
        candidato_id: existingByCandidatura.id,
      })
    } catch (_) {}

    try {
      var existingByEmailCpfVaga = $app.findFirstRecordByFilter(
        'candidates',
        'email = {:email} && cpf = {:cpf} && vacancy_id = {:vid}',
        email,
        cpf,
        vacancyId,
      )
      writeLog(wordpressCandidaturaId, 'duplicada', 'Candidato já cadastrado para esta vaga')
      return e.json(409, {
        ok: false,
        message: 'Candidato já cadastrado para esta vaga',
        email: email,
        cpf: cpf,
      })
    } catch (_) {}

    var vacancyOrdemExecucao = ''
    var vacancyTipoVaga = ''
    var vacancyTipoContrato = ''
    if (vacancyRecord) {
      try {
        var oe = vacancyRecord.getString('ordem_execucao')
        if (oe) {
          vacancyOrdemExecucao = oe
        }
      } catch (oeErr) {
        $app
          .logger()
          .error(
            'wordpress_candidate_import: failed to read ordem_execucao from vacancy',
            'vacancyId',
            vacancyId,
            'error',
            oeErr.message || String(oeErr),
          )
      }
      try {
        vacancyTipoVaga = vacancyRecord.getString('tipo_vaga')
      } catch (tvErr) {
        $app
          .logger()
          .error(
            'wordpress_candidate_import: failed to read tipo_vaga from vacancy',
            'vacancyId',
            vacancyId,
            'error',
            tvErr.message || String(tvErr),
          )
      }
      try {
        vacancyTipoContrato = vacancyRecord.getString('tipo_contrato')
      } catch (tcErr) {
        $app
          .logger()
          .error(
            'wordpress_candidate_import: failed to read tipo_contrato from vacancy',
            'vacancyId',
            vacancyId,
            'error',
            tcErr.message || String(tcErr),
          )
      }
    }

    var candidatesCol = $app.findCollectionByNameOrId('candidates')
    var candidate = new Record(candidatesCol)
    candidate.set('vacancy_id', vacancyId)
    candidate.set('nome', nome)
    candidate.set('email', email)
    candidate.set('telefone', telefone)
    candidate.set('cpf', cpf)
    candidate.set('bairro', bairro)
    candidate.set('cidade', cidade)
    if (ranking !== null && !isNaN(ranking)) {
      candidate.set('rank', ranking)
    }
    candidate.set('wordpress_candidatura_id', wordpressCandidaturaId)
    candidate.set('status_candidato', 'Análise do RH')
    if (vacancyOrdemExecucao) {
      candidate.set('ordem_execucao', vacancyOrdemExecucao)
    }
    if (vacancyTipoVaga) candidate.set('tipo_vaga', vacancyTipoVaga)
    if (vacancyTipoContrato) candidate.set('tipo_contrato', vacancyTipoContrato)

    try {
      $app.save(candidate)
    } catch (saveErr) {
      var errMsg = saveErr.message || 'Erro de validação ao criar candidato'
      writeLog(wordpressCandidaturaId, 'erro', errMsg)
      return e.json(400, { ok: false, message: errMsg })
    }

    writeLog(wordpressCandidaturaId, 'sucesso', 'Candidato criado no SKIP')

    return e.json(201, {
      ok: true,
      message: 'Candidato criado no SKIP',
      candidato_id: candidate.id,
      vaga_id: vacancyId,
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
