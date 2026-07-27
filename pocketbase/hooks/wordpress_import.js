try {
  routerAdd('POST', '/backend/v1/vagas/wordpress', (e) => {
    function logImport(jobId, status, mensagem) {
      try {
        var logCol = $app.findCollectionByNameOrId('wordpress_import_logs')
        var logRec = new Record(logCol)
        logRec.set('wordpress_job_id', jobId || '')
        logRec.set('origem', 'wordpress')
        logRec.set('status', status)
        logRec.set('mensagem', mensagem || '')
        $app.save(logRec)
      } catch (logErr) {
        console.log('WordPress import: failed to log import:', logErr.message)
      }
    }

    function findOrCreateRef(colName, nome) {
      if (!nome) return ''
      try {
        var existing = $app.findFirstRecordByData(colName, 'nome', nome)
        return existing.id
      } catch (_) {}
      try {
        var col = $app.findCollectionByNameOrId(colName)
        var rec = new Record(col)
        rec.set('nome', nome)
        $app.save(rec)
        return rec.id
      } catch (refErr) {
        console.log('WordPress import: failed to find/create ' + colName + ':', refErr.message)
        return ''
      }
    }

    try {
      console.log('WordPress import: request received')

      var expectedToken = $secrets.get('WORDPRESS_INTEGRATION_TOKEN') || ''
      var authHeader = e.request.header.get('Authorization') || ''

      if (!authHeader.startsWith('Bearer ')) {
        logImport('', 'erro', 'Missing or invalid Authorization header')
        return e.json(401, {
          error: 'Missing or invalid Authorization header. Expected: Bearer <token>',
        })
      }

      var token = authHeader.slice(7)
      if (!expectedToken || token !== expectedToken) {
        logImport('', 'erro', 'Invalid or missing token')
        return e.json(403, { error: 'Invalid or missing token' })
      }

      var body = e.requestInfo().body || {}
      var jobId = body.wordpress_job_id || ''

      if (!jobId) {
        logImport('', 'erro', 'wordpress_job_id is required')
        return e.json(400, { error: 'wordpress_job_id is required' })
      }

      console.log('WordPress import: processing job_id:', jobId)

      var duplicate = false
      try {
        $app.findFirstRecordByData('vacancies', 'wordpress_job_id', jobId)
        duplicate = true
      } catch (_) {}

      if (duplicate) {
        console.log('WordPress import: duplicate detected for job_id:', jobId)
        logImport(jobId, 'duplicada', 'Vaga ja existe com este wordpress_job_id')
        return e.json(200, { duplicate: true })
      }

      var cargoId = findOrCreateRef('cargos', body.cargo || body.titulo || '')
      var cidadeId = findOrCreateRef('cidades', body.cidade || '')
      var tipoVagaId = findOrCreateRef('tipos_vaga', body.tipo_vaga || '')

      var tipoContratoId = ''
      if (body.tipo_vaga) {
        try {
          var tcRec = $app.findFirstRecordByData('tipos_contrato', 'nome', body.tipo_vaga)
          tipoContratoId = tcRec.id
        } catch (_) {
          console.log('WordPress import: tipo_contrato not found for name:', body.tipo_vaga)
        }
      }

      var clienteId = ''
      try {
        var clienteRec = $app.findFirstRecordByData('clientes', 'nome', 'PMais')
        clienteId = clienteRec.id
      } catch (_) {
        try {
          var clientesCol = $app.findCollectionByNameOrId('clientes')
          var newCliente = new Record(clientesCol)
          newCliente.set('nome', 'PMais')
          $app.save(newCliente)
          clienteId = newCliente.id
        } catch (clienteErr) {
          console.log('WordPress import: failed to create cliente PMais:', clienteErr.message)
        }
      }

      var responsavelId = ''
      try {
        var userRec = $app.findFirstRecordByData('users', 'name', 'PMais - Web')
        responsavelId = userRec.id
      } catch (_) {
        console.log('WordPress import: PMais - Web user not found, skipping responsavel_rh')
      }

      var vacCol = $app.findCollectionByNameOrId('vacancies')
      var newVacancy = new Record(vacCol)

      newVacancy.set('wordpress_job_id', jobId)
      newVacancy.set('status_vaga', 'Aberta')

      if (cargoId) newVacancy.set('cargo', cargoId)
      if (cidadeId) newVacancy.set('cidade', cidadeId)
      if (tipoContratoId) newVacancy.set('tipo_contrato', tipoContratoId)
      if (tipoVagaId) newVacancy.set('tipo_vaga', tipoVagaId)
      if (clienteId) newVacancy.set('cliente', clienteId)
      if (responsavelId) newVacancy.set('responsavel_rh', responsavelId)

      newVacancy.set('responsavel_operacional', 'PMais - Web')

      var qtd = parseInt(body.quantidade, 10)
      if (isNaN(qtd) || qtd < 1) qtd = 1
      newVacancy.set('quantidade_vagas', qtd)

      if (body.salario_faixa) newVacancy.set('salario_faixa', body.salario_faixa)
      if (body.descricao) newVacancy.set('especificacoes', body.descricao)
      if (body.especificacoes) newVacancy.set('especificacoes', body.especificacoes)
      var obsParts = []
      if (body.link_publico) obsParts.push('Link público: ' + body.link_publico)
      if (body.perfil_interno) obsParts.push('Perfil interno: ' + body.perfil_interno)
      if (obsParts.length > 0) {
        newVacancy.set('observacoes_internas', obsParts.join('\n'))
      } else if (body.observacoes) {
        newVacancy.set('observacoes_internas', body.observacoes)
      }
      if (body.prioridade) newVacancy.set('prioridade', body.prioridade)
      if (body.data_publicacao) newVacancy.set('data_abertura', body.data_publicacao)
      if (body.prazo_desejado) newVacancy.set('prazo_desejado', body.prazo_desejado)

      $app.save(newVacancy)

      console.log('WordPress import: vacancy created with id:', newVacancy.id)

      logImport(jobId, 'sucesso', 'Vaga criada no SKIP')

      return e.json(200, { ok: true, vaga_id: newVacancy.id, message: 'Vaga criada no SKIP' })
    } catch (err) {
      console.log('WordPress import: unexpected error:', err.message)
      var errBody = e.requestInfo().body || {}
      var errJobId = errBody.wordpress_job_id || ''
      logImport(errJobId, 'erro', err.message || 'Internal server error')
      return e.json(500, { error: 'Internal server error', details: err.message })
    }
  })
  console.log('WordPress import: hook registered successfully at POST /backend/v1/vagas/wordpress')
} catch (hookErr) {
  console.log('WordPress import: failed to register hook:', hookErr.message)
}
