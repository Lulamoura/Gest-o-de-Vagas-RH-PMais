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
    s = stripAccents(s)
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .trim()
    return s
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

  var setVacancyFields = function (v, isUpd) {
    if (body.quantidade !== undefined && body.quantidade !== null) {
      var q = parseInt(body.quantidade, 10)
      if (!isNaN(q) && q > 0) v.set('quantidade_vagas', q)
    } else if (!isUpd && body.quantidade_vagas !== undefined && body.quantidade_vagas !== null) {
      v.set('quantidade_vagas', body.quantidade_vagas)
    }
    if (body.data_publicacao) {
      try {
        var d = new Date(body.data_publicacao)
        if (!isNaN(d.getTime())) v.set('data_abertura', d.toISOString().split('T')[0])
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
    if (body.observacoes_internas) v.set('observacoes_internas', String(body.observacoes_internas))
    if (!isUpd) {
      v.set('wordpress_job_id', jobId)
      v.set('status_vaga', 'Aberta')
      v.set('prioridade', 'Média')
      v.set('origem', body.origem || 'wordpress')
    }
  }

  var syncRequisitionPublication = function (wpJobId, linkPublico) {
    var reqId = body.requisition_id || ''
    if (!reqId) return

    var req = null
    try {
      req = $app.findRecordById('requisitions', reqId)
    } catch (_) {
      try {
        $app.logger().warn('wordpress_import: requisition not found', 'requisition_id', reqId)
      } catch (__) {}
      return
    }

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
      } catch (__) {}
      return
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
        } catch (__) {}
      }
      return
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
      } catch (__) {}
      return
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
      } catch (__) {}
      return
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
      } catch (__) {}
    }
  }

  var existing = null
  try {
    existing = $app.findFirstRecordByData('vacancies', 'wordpress_job_id', jobId)
  } catch (_) {}

  if (existing) {
    try {
      setVacancyFields(existing, true)
      $app.save(existing)
      writeLog(jobId, 'sucesso', 'Vaga atualizada via importação WordPress (idempotente)')
      syncRequisitionPublication(jobId, body.link_publico || '')
      return e.json(200, { ok: true, duplicate: true, vaga_id: existing.id })
    } catch (err) {
      writeLog(jobId, 'erro', 'Erro ao atualizar vaga existente: ' + (err.message || ''))
      return e.json(500, { ok: false, status: 'erro', message: err.message })
    }
  }

  try {
    var vc = $app.findCollectionByNameOrId('vacancies')
    var vac = new Record(vc)
    setVacancyFields(vac, false)
    $app.save(vac)
    writeLog(jobId, 'sucesso', 'Vaga importada com sucesso')
    syncRequisitionPublication(jobId, body.link_publico || '')
    return e.json(200, { ok: true, status: 'sucesso', vaga_id: vac.id, vacancy: vac.id })
  } catch (err) {
    writeLog(jobId, 'erro', err.message || 'Erro ao importar vaga')
    return e.json(500, { ok: false, status: 'erro', message: err.message })
  }
})
