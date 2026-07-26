routerAdd('POST', '/backend/v1/vagas/wordpress', (e) => {
  var expectedToken = $secrets.get('WORDPRESS_INTEGRATION_TOKEN')
  var authHeader = e.request.header.get('Authorization') || ''
  var token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  var logImport = function (wpJobId, status, mensagem) {
    try {
      var logCol = $app.findCollectionByNameOrId('wordpress_import_logs')
      var logRec = new Record(logCol)
      logRec.set('wordpress_job_id', wpJobId || '')
      logRec.set('origem', 'wordpress')
      logRec.set('status', status)
      logRec.set('mensagem', mensagem || '')
      $app.save(logRec)
    } catch (logErr) {}
  }

  if (!expectedToken || token === '' || token !== expectedToken) {
    logImport('', 'erro', 'Token inválido ou ausente')
    return e.json(401, { ok: false, error: 'Unauthorized' })
  }

  var body = e.requestInfo().body || {}

  if (!body.wordpress_job_id || !body.titulo) {
    var validationMsg = 'Campos obrigatórios ausentes: wordpress_job_id e titulo são obrigatórios'
    logImport(body.wordpress_job_id || '', 'erro', validationMsg)
    return e.json(400, { ok: false, error: validationMsg })
  }

  try {
    var existing = $app.findFirstRecordByData(
      'vacancies',
      'wordpress_job_id',
      body.wordpress_job_id,
    )
    if (existing) {
      logImport(body.wordpress_job_id, 'duplicada', 'Vaga já importada')
      return e.json(200, {
        ok: true,
        duplicate: true,
        vaga_id: existing.id,
        message: 'Vaga já importada',
      })
    }
  } catch (_) {}

  var cargoId = ''
  try {
    var cargo = $app.findFirstRecordByData('cargos', 'nome', body.titulo)
    cargoId = cargo.id
  } catch (_) {
    try {
      var cargoCol = $app.findCollectionByNameOrId('cargos')
      var cargoRec = new Record(cargoCol)
      cargoRec.set('nome', body.titulo)
      $app.save(cargoRec)
      cargoId = cargoRec.id
    } catch (_) {}
  }

  var cidadeId = ''
  if (body.localizacao) {
    try {
      var cidade = $app.findFirstRecordByData('cidades', 'nome', body.localizacao)
      cidadeId = cidade.id
    } catch (_) {
      try {
        var cidadeCol = $app.findCollectionByNameOrId('cidades')
        var cidadeRec = new Record(cidadeCol)
        cidadeRec.set('nome', body.localizacao)
        $app.save(cidadeRec)
        cidadeId = cidadeRec.id
      } catch (_) {}
    }
  }

  var tipoContratoId = ''
  if (body.tipo_vaga) {
    try {
      var tc = $app.findFirstRecordByData('tipos_contrato', 'nome', body.tipo_vaga)
      tipoContratoId = tc.id
    } catch (_) {
      try {
        var tcCol = $app.findCollectionByNameOrId('tipos_contrato')
        var tcRec = new Record(tcCol)
        tcRec.set('nome', body.tipo_vaga)
        $app.save(tcRec)
        tipoContratoId = tcRec.id
      } catch (_) {}
    }
  }

  var clienteId = ''
  try {
    var cliente = $app.findFirstRecordByData('clientes', 'nome', 'PMais')
    clienteId = cliente.id
  } catch (_) {
    try {
      var clienteCol = $app.findCollectionByNameOrId('clientes')
      var clienteRec = new Record(clienteCol)
      clienteRec.set('nome', 'PMais')
      $app.save(clienteRec)
      clienteId = clienteRec.id
    } catch (_) {}
  }

  var responsavelRhId = ''
  try {
    var user = $app.findFirstRecordByData('users', 'name', 'PMais - Web')
    responsavelRhId = user.id
  } catch (_) {}

  var obsParts = []
  if (body.link_publico) obsParts.push(body.link_publico)
  if (body.perfil_interno) obsParts.push(body.perfil_interno)
  var observacoes = obsParts.join('\n')

  try {
    var vacCol = $app.findCollectionByNameOrId('vacancies')
    var vacRec = new Record(vacCol)
    vacRec.set('wordpress_job_id', body.wordpress_job_id)
    vacRec.set('quantidade_vagas', 1)
    vacRec.set('status_vaga', 'Aberta')
    vacRec.set('prioridade', 'Média')
    if (cargoId) vacRec.set('cargo', cargoId)
    if (cidadeId) vacRec.set('cidade', cidadeId)
    if (tipoContratoId) vacRec.set('tipo_contrato', tipoContratoId)
    if (clienteId) vacRec.set('cliente', clienteId)
    if (responsavelRhId) vacRec.set('responsavel_rh', responsavelRhId)
    if (body.data_publicacao) vacRec.set('data_abertura', body.data_publicacao)
    if (body.descricao) vacRec.set('especificacoes', body.descricao)
    if (observacoes) vacRec.set('observacoes_internas', observacoes)

    $app.save(vacRec)

    logImport(body.wordpress_job_id, 'sucesso', 'Vaga criada no SKIP')
    return e.json(200, { ok: true, vaga_id: vacRec.id, message: 'Vaga criada no SKIP' })
  } catch (createErr) {
    var errMsg = createErr && createErr.message ? createErr.message : 'erro desconhecido'
    if (errMsg.indexOf('UNIQUE constraint') !== -1) {
      logImport(body.wordpress_job_id, 'duplicada', 'Vaga já importada (race condition)')
      try {
        var existingRace = $app.findFirstRecordByData(
          'vacancies',
          'wordpress_job_id',
          body.wordpress_job_id,
        )
        return e.json(200, {
          ok: true,
          duplicate: true,
          vaga_id: existingRace.id,
          message: 'Vaga já importada',
        })
      } catch (_) {}
    }
    logImport(body.wordpress_job_id, 'erro', 'Erro ao criar vaga: ' + errMsg)
    return e.json(500, { ok: false, error: 'Erro ao criar vaga: ' + errMsg })
  }
})
