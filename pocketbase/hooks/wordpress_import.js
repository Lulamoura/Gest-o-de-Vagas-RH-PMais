// TECHNICAL DUPLICATION NOTICE:
// This file shares field-building and requisition-sync logic with
// wordpress_import_vagas.js (POST /backend/v1/vagas/wordpress).
// The PocketBase JSVM executes each hook callback in a separate VM pool,
// so top-level function declarations are NOT accessible across files.
// Both files must be kept in sync. If you change the field-building,
// change-detection, or requisition-sync logic here, apply the equivalent
// change to the other file.

routerAdd('POST', '/backend/v1/wordpress-import', (e) => {
  var authHeader = e.request.header.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer '))
    return e.json(401, { ok: false, message: 'Acesso não autorizado' })
  var token = authHeader.slice(7).trim()
  var expectedToken = $secrets.get('WORDPRESS_INTEGRATION_TOKEN') || ''
  if (!expectedToken || token !== expectedToken)
    return e.json(401, { ok: false, message: 'Acesso não autorizado' })

  var body = e.requestInfo().body || {}
  var jobId = body.wordpress_job_id || ''
  var origem = body.origem || 'wordpress'
  if (!jobId) return e.badRequestError('wordpress_job_id é obrigatório')

  var changesDetected = false

  var requisition = null
  var solicitanteName = ''
  var deptName = ''
  if (body.requisition_id) {
    try {
      requisition = $app.findRecordById('requisitions', body.requisition_id)
      var solId = requisition.getString('solicitante')
      if (solId) {
        try {
          solicitanteName = $app.findRecordById('users', solId).getString('name')
        } catch (_) {}
      }
      var dId = requisition.getString('departamento')
      if (dId) {
        try {
          deptName = $app.findRecordById('departamentos', dId).getString('nome')
        } catch (_) {}
      }
    } catch (_) {
      requisition = null
    }
  }

  var ALIASES = {
    pmais: 'P Mais',
    'p mais': 'P Mais',
    'p-mais': 'P Mais',
    'p+mais': 'P Mais',
    'pmais servicos': 'P Mais',
    'p-mais servicos': 'P Mais',
    'p+mais servicos': 'P Mais',
    'p mais servicos': 'P Mais',
    'pmais servico': 'P Mais',
    'pmais terceirizacao': 'P Mais',
    'p-mais terceirizacao': 'P Mais',
    'p+mais terceirizacao': 'P Mais',
    'p mais terceirizacao': 'P Mais',
    'pmais terceiracao': 'P Mais',
    'p-mais terceiracao': 'P Mais',
    'p+mais terceiracao': 'P Mais',
    'p mais terceiracao': 'P Mais',
  }
  var STATES = [
    'AC',
    'AL',
    'AP',
    'AM',
    'BA',
    'CE',
    'DF',
    'ES',
    'GO',
    'MA',
    'MT',
    'MS',
    'MG',
    'PA',
    'PB',
    'PR',
    'PE',
    'PI',
    'RJ',
    'RN',
    'RS',
    'RO',
    'RR',
    'SC',
    'SP',
    'SE',
    'TO',
  ]

  var stripAccents = function (s) {
    try {
      return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    } catch (_) {
      var m = {
        á: 'a',
        à: 'a',
        â: 'a',
        ã: 'a',
        ä: 'a',
        é: 'e',
        è: 'e',
        ê: 'e',
        ë: 'e',
        í: 'i',
        ì: 'i',
        î: 'i',
        ï: 'i',
        ó: 'o',
        ò: 'o',
        ô: 'o',
        õ: 'o',
        ö: 'o',
        ú: 'u',
        ù: 'u',
        û: 'u',
        ü: 'u',
        ç: 'c',
        ñ: 'n',
        Á: 'A',
        À: 'A',
        Â: 'A',
        Ã: 'A',
        Ä: 'A',
        É: 'E',
        È: 'E',
        Ê: 'E',
        Ë: 'E',
        Í: 'I',
        Ì: 'I',
        Î: 'I',
        Ï: 'I',
        Ó: 'O',
        Ò: 'O',
        Ô: 'O',
        Õ: 'O',
        Ö: 'O',
        Ú: 'U',
        Ù: 'U',
        Û: 'U',
        Ü: 'U',
        Ç: 'C',
        Ñ: 'N',
      }
      var r = ''
      for (var i = 0; i < s.length; i++) {
        r += m[s.charAt(i)] || s.charAt(i)
      }
      return r
    }
  }
  var normalizeKey = function (str) {
    if (!str) return ''
    var s = String(str).trim()
    try {
      s = s.normalize('NFC')
    } catch (_) {}
    return stripAccents(s)
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .trim()
  }
  var normalizeCityDisplay = function (raw) {
    if (!raw) return ''
    var s = String(raw).trim()
    try {
      s = s.normalize('NFC')
    } catch (_) {}
    var m = s.match(/^(.+?)[\s,\-/]+([A-Za-z]{2})\s*$/)
    if (m && STATES.indexOf(m[2].toUpperCase()) !== -1)
      return m[1].trim() + ' - ' + m[2].toUpperCase()
    return s
  }
  var getEffectiveKey = function (col, name) {
    var key = normalizeKey(name)
    if (col === 'clientes' && ALIASES[key]) return normalizeKey(ALIASES[key])
    return key
  }
  var findOrCreateRef = function (colName, nome, isCity) {
    if (!nome || String(nome).trim() === '') return ''
    var display = isCity ? normalizeCityDisplay(nome) : String(nome).trim()
    try {
      display = display.normalize('NFC')
    } catch (_) {}
    var inKey = getEffectiveKey(colName, display)
    var records = []
    try {
      records = $app.findRecordsByFilter(colName, "id != ''", 'nome', 0, 0)
    } catch (_) {}
    for (var i = 0; i < records.length; i++) {
      if (getEffectiveKey(colName, records[i].getString('nome')) === inKey) return records[i].id
    }
    var nameToCreate =
      colName === 'clientes' && ALIASES[normalizeKey(display)]
        ? ALIASES[normalizeKey(display)]
        : display
    try {
      var col = $app.findCollectionByNameOrId(colName)
      var rec = new Record(col)
      rec.set('nome', nameToCreate)
      $app.save(rec)
      return rec.id
    } catch (_) {
      return ''
    }
  }
  var writeLog = function (wpJobId, status, msg) {
    try {
      var lc = $app.findCollectionByNameOrId('wordpress_import_logs')
      var lg = new Record(lc)
      lg.set('wordpress_job_id', wpJobId)
      lg.set('origem', origem)
      lg.set('status', status)
      lg.set('mensagem', msg)
      $app.save(lg)
    } catch (_) {}
  }
  var compilePerfilInterno = function (req, dName) {
    if (!req) return ''
    var sections = []
    var fields = [
      ['jornada', 'Jornada'],
      ['horario', 'Horário'],
      ['escala', 'Escala'],
      ['remuneracao', 'Remuneração'],
      ['beneficios', 'Benefícios'],
      ['requisitos', 'Requisitos'],
      ['escolaridade', 'Escolaridade'],
      ['experiencia', 'Experiência'],
      ['justificativa', 'Justificativa'],
    ]
    for (var i = 0; i < fields.length; i++) {
      var val = req.getString(fields[i][0])
      if (val && String(val).trim() !== '') sections.push(fields[i][1] + ': ' + val)
    }
    if (dName) sections.push('Departamento: ' + dName)
    return sections.join('\n')
  }

  var setVacancyFields = function (v, isUpd, req, solName, dName) {
    var applyField = function (field, value, forceEmpty) {
      if (!forceEmpty && (value === undefined || value === null || String(value) === '')) return
      var strVal = String(value || '')
      if (isUpd) {
        var curVal = String(v.getString(field) || '')
        if (curVal === strVal) return
        v.set(field, value || '')
        changesDetected = true
      } else {
        v.set(field, value || '')
      }
    }

    if (req) {
      // === REQUISITION AS OFFICIAL SOURCE (GV) — administrative/commercial data ===
      applyField('cliente', req.getString('cliente'))
      applyField('cargo', req.getString('cargo'))
      applyField('cidade', req.getString('cidade'))
      applyField('tipo_vaga', req.getString('tipo_vaga'))
      applyField('tipo_contrato', req.getString('tipo_contrato'))
      var reqQtd = parseInt(req.getString('quantidade_vagas') || '0', 10)
      if (reqQtd > 0) applyField('quantidade_vagas', reqQtd)
      applyField('prazo_desejado', req.getString('prazo_desejado'))
      applyField('salario_faixa', req.getString('faixa_salarial'))
      applyField('prioridade', req.getString('prioridade'))
      // especificacoes must equal requisition specifications — clear WP description if empty
      applyField('especificacoes', req.getString('especificacoes'), true)
      applyField('observacoes_internas', req.getString('observacoes_internas'), true)
      applyField('responsavel_operacional', solName)
      applyField('ordem_execucao', req.getString('numero_oe'))
      applyField('perfil_interno', compilePerfilInterno(req, dName), true)

      // === WORDPRESS AS OFFICIAL SOURCE — editorial/publication fields ===
      if (body.data_publicacao) {
        try {
          var d = new Date(body.data_publicacao)
          if (!isNaN(d.getTime())) applyField('data_abertura', d.toISOString().split('T')[0])
        } catch (_) {}
      } else if (body.data_abertura) {
        applyField('data_abertura', body.data_abertura)
      }
      if (body.link_publico) applyField('link_publico', String(body.link_publico))
      if (body.origem) applyField('origem', String(body.origem))

      // DO NOT use body.empresa for cliente
      // DO NOT use body.descricao for especificacoes
      // DO NOT use body.titulo for cargo
      // DO NOT use body.salario_faixa, body.observacoes_internas, body.perfil_interno

      if (!isUpd) {
        v.set('wordpress_job_id', jobId)
        v.set('status_vaga', 'Aberta')
        if (!req.getString('prioridade')) v.set('prioridade', 'Média')
        v.set('origem', body.origem || 'wordpress')
      }
    } else {
      // === WORDPRESS-DIRECT FLOW (no requisition) — existing behavior ===
      if (body.quantidade !== undefined && body.quantidade !== null) {
        var q = parseInt(body.quantidade, 10)
        if (!isNaN(q) && q > 0) v.set('quantidade_vagas', q)
      } else if (!isUpd && body.quantidade_vagas !== undefined && body.quantidade_vagas !== null) {
        v.set('quantidade_vagas', body.quantidade_vagas)
      }
      if (body.data_publicacao) {
        try {
          var d2 = new Date(body.data_publicacao)
          if (!isNaN(d2.getTime())) v.set('data_abertura', d2.toISOString().split('T')[0])
        } catch (_) {}
      } else if (body.data_abertura) v.set('data_abertura', body.data_abertura)
      if (body.titulo) {
        var cId = findOrCreateRef('cargos', body.titulo, false)
        if (cId) v.set('cargo', cId)
      }
      if (body.localizacao) {
        var cid = findOrCreateRef('cidades', body.localizacao, true)
        if (cid) v.set('cidade', cid)
      }
      if (body.tipo_contrato) {
        var tcId = findOrCreateRef('tipos_contrato', body.tipo_contrato, false)
        if (tcId) v.set('tipo_contrato', tcId)
      }
      if (body.empresa) {
        var clId = findOrCreateRef('clientes', body.empresa, false)
        if (clId) v.set('cliente', clId)
      } else if (body.cliente) {
        var clId2 = findOrCreateRef('clientes', body.cliente, false)
        if (clId2) v.set('cliente', clId2)
      }
      if (body.link_publico) v.set('link_publico', String(body.link_publico))
      if (body.descricao) v.set('especificacoes', String(body.descricao))
      if (body.perfil_interno) v.set('perfil_interno', String(body.perfil_interno))
      if (body.origem) v.set('origem', String(body.origem))
      if (body.responsavel_operacional)
        v.set('responsavel_operacional', String(body.responsavel_operacional))
      if (body.salario_faixa) v.set('salario_faixa', String(body.salario_faixa))
      if (body.observacoes_internas)
        v.set('observacoes_internas', String(body.observacoes_internas))
      if (!isUpd) {
        v.set('wordpress_job_id', jobId)
        v.set('status_vaga', 'Aberta')
        v.set('prioridade', 'Média')
        v.set('origem', body.origem || 'wordpress')
      }
    }
  }

  var syncRequisitionPublication = function (wpJobId, linkPublico) {
    var reqId = body.requisition_id || ''
    if (!reqId) return { ok: true, changed: false, message: 'no requisition_id' }
    if (!requisition)
      return { ok: true, changed: false, message: 'requisition not found or invalid' }

    var req = requisition
    var reqWpJobId = req.getString('wordpress_job_id')
    if (reqWpJobId && reqWpJobId !== wpJobId) {
      try {
        $app
          .logger()
          .warn(
            'wordpress_import: requisition wordpress_job_id mismatch',
            'requisition_id',
            reqId,
            'expected',
            reqWpJobId,
            'received',
            wpJobId,
          )
      } catch (_) {}
      return { ok: true, changed: false, message: 'wordpress_job_id mismatch' }
    }

    var currentStatus = req.getString('status')

    if (currentStatus === 'Publicada') {
      var needsUpdate = false
      if (linkPublico && !req.getString('link_publico')) {
        req.set('link_publico', linkPublico)
        needsUpdate = true
      }
      if (!req.getString('data_publicacao')) {
        req.set('data_publicacao', new Date().toISOString().split('T')[0])
        needsUpdate = true
      }
      if (needsUpdate) {
        try {
          $app.save(req)
        } catch (saveErr) {
          return {
            ok: false,
            changed: false,
            message: 'failed to update published requisition: ' + String(saveErr),
          }
        }
      }
      return { ok: true, changed: needsUpdate, message: 'already published' }
    }

    if (currentStatus !== 'Rascunho criado no WordPress') {
      try {
        $app
          .logger()
          .warn(
            'wordpress_import: requisition not in draft status, skipping publication sync',
            'requisition_id',
            reqId,
            'current_status',
            currentStatus,
          )
      } catch (_) {}
      return { ok: true, changed: false, message: 'not in draft status, skipping' }
    }

    var today = new Date().toISOString().split('T')[0]
    req.set('status', 'Publicada')
    req.set('wordpress_job_id', wpJobId)
    if (linkPublico) req.set('link_publico', linkPublico)
    req.set('data_publicacao', today)
    req.set('wordpress_sync_status', 'sucesso')
    req.set('wordpress_sync_date', today)

    try {
      $app.save(req)
    } catch (saveErr) {
      try {
        $app
          .logger()
          .error(
            'wordpress_import: failed to update requisition to Publicada',
            'requisition_id',
            reqId,
            'error',
            String(saveErr),
          )
      } catch (_) {}
      return {
        ok: false,
        changed: false,
        message: 'failed to publish requisition: ' + String(saveErr),
      }
    }

    try {
      var historyCol = $app.findCollectionByNameOrId('requisition_history')
      var historyRecord = new Record(historyCol)
      historyRecord.set('requisition_id', reqId)
      historyRecord.set('status_anterior', 'Rascunho criado no WordPress')
      historyRecord.set('status_novo', 'Publicada')
      historyRecord.set('acao', 'wordpress')
      historyRecord.set('observacao', 'Vaga publicada no WordPress e sincronizada com o GV')
      $app.save(historyRecord)
    } catch (histErr) {
      try {
        $app
          .logger()
          .error(
            'wordpress_import: failed to create requisition history for Publicada',
            'requisition_id',
            reqId,
            'error',
            String(histErr),
          )
      } catch (_) {}
    }

    return { ok: true, changed: true, message: 'published' }
  }

  // === FIND EXISTING VACANCY ===
  var existing = null
  try {
    existing = $app.findFirstRecordByData('vacancies', 'wordpress_job_id', jobId)
  } catch (_) {}

  if (existing) {
    changesDetected = false
    setVacancyFields(existing, true, requisition, solicitanteName, deptName)

    if (changesDetected || !requisition) {
      try {
        $app.save(existing)
      } catch (err) {
        writeLog(jobId, 'erro', 'Erro ao atualizar vaga existente: ' + (err.message || ''))
        return e.json(500, { ok: false, status: 'erro', message: err.message })
      }

      // Write requisition_history only when there is an effective data change
      if (requisition && changesDetected && body.requisition_id) {
        try {
          var syncHistCol = $app.findCollectionByNameOrId('requisition_history')
          var syncHistRec = new Record(syncHistCol)
          syncHistRec.set('requisition_id', body.requisition_id)
          syncHistRec.set('status_novo', requisition.getString('status'))
          syncHistRec.set('acao', 'sincronizacao_vaga')
          syncHistRec.set(
            'observacao',
            'Dados da vaga sincronizados com a requisição via WordPress',
          )
          $app.save(syncHistRec)
        } catch (_) {}
      }
    }

    writeLog(
      jobId,
      'sucesso',
      changesDetected
        ? 'Vaga atualizada via importação WordPress'
        : 'Vaga já estava atualizada (idempotente)',
    )

    var syncResult = syncRequisitionPublication(jobId, body.link_publico || '')
    if (!syncResult.ok) {
      return e.json(500, {
        ok: false,
        message: 'Vaga salva mas erro na sincronização da requisição: ' + syncResult.message,
        vaga_id: existing.id,
      })
    }

    return e.json(200, {
      ok: true,
      duplicate: true,
      vaga_id: existing.id,
      changes: changesDetected,
    })
  }

  // === CREATE NEW VACANCY ===
  try {
    var vc = $app.findCollectionByNameOrId('vacancies')
    var vac = new Record(vc)
    changesDetected = true
    setVacancyFields(vac, false, requisition, solicitanteName, deptName)
    $app.save(vac)
    writeLog(jobId, 'sucesso', 'Vaga importada com sucesso')

    var syncResult2 = syncRequisitionPublication(jobId, body.link_publico || '')
    if (!syncResult2.ok) {
      return e.json(500, {
        ok: false,
        message: 'Vaga criada mas erro na sincronização da requisição: ' + syncResult2.message,
        vaga_id: vac.id,
      })
    }

    return e.json(200, { ok: true, status: 'sucesso', vaga_id: vac.id, vacancy: vac.id })
  } catch (err) {
    writeLog(jobId, 'erro', err.message || 'Erro ao importar vaga')
    return e.json(500, { ok: false, status: 'erro', message: err.message })
  }
})
