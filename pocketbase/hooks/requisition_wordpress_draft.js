routerAdd(
  'POST',
  '/backend/v1/requisitions/{id}/wordpress-draft',
  (e) => {
    var id = e.request.pathValue('id')
    var req = $app.findRecordById('requisitions', id)

    var existingJobId = req.getString('wordpress_job_id')
    if (existingJobId) {
      return e.json(200, {
        ok: true,
        duplicate: true,
        wordpress_job_id: existingJobId,
        wordpress_admin_url: req.getString('wordpress_admin_url'),
      })
    }

    if (req.getString('status') !== 'Aprovada') {
      return e.badRequestError(
        "A requisição deve estar com status 'Aprovada' para criar o rascunho no WordPress",
      )
    }

    var token = $secrets.get('WORDPRESS_INTEGRATION_TOKEN') || ''
    if (!token) {
      req.set('wordpress_sync_status', 'erro')
      req.set('wordpress_error_message', 'Token de integração WordPress não configurado')
      $app.save(req)
      return e.json(500, { message: 'Token de integração WordPress não configurado' })
    }

    var wpBaseUrl = ''
    try {
      var vacancies = $app.findRecordsByFilter('vacancies', "link_publico != ''", '-created', 1, 0)
      if (vacancies.length > 0) {
        var link = vacancies[0].getString('link_publico')
        var match = link.match(/^(https?:\/\/[^\/]+)/)
        if (match) wpBaseUrl = match[1]
      }
    } catch (_) {}

    if (!wpBaseUrl) {
      wpBaseUrl = $secrets.get('SITE_URL') || ''
      if (wpBaseUrl.endsWith('/')) wpBaseUrl = wpBaseUrl.slice(0, -1)
    }

    if (!wpBaseUrl) {
      req.set('wordpress_sync_status', 'erro')
      req.set('wordpress_error_message', 'URL do WordPress não configurada')
      $app.save(req)
      return e.json(500, { message: 'URL do WordPress não configurada' })
    }

    var cargoName = ''
    var clienteName = ''
    var cidadeName = ''
    var tipoContratoName = ''

    var cargoId = req.getString('cargo')
    if (cargoId) {
      try {
        cargoName = $app.findRecordById('cargos', cargoId).getString('nome')
      } catch (_) {}
    }
    var clienteId = req.getString('cliente')
    if (clienteId) {
      try {
        clienteName = $app.findRecordById('clientes', clienteId).getString('nome')
      } catch (_) {}
    }
    var cidadeId = req.getString('cidade')
    if (cidadeId) {
      try {
        cidadeName = $app.findRecordById('cidades', cidadeId).getString('nome')
      } catch (_) {}
    }
    var tipoContratoId = req.getString('tipo_contrato')
    if (tipoContratoId) {
      try {
        tipoContratoName = $app.findRecordById('tipos_contrato', tipoContratoId).getString('nome')
      } catch (_) {}
    }

    var pubFields = [
      'jornada',
      'horario',
      'escala',
      'remuneracao',
      'beneficios',
      'requisitos',
      'escolaridade',
      'experiencia',
    ]
    var meta = {}
    for (var i = 0; i < pubFields.length; i++) {
      var val = req.getString(pubFields[i])
      if (val) meta[pubFields[i]] = val
    }
    meta['quantidade_vagas'] = String(req.getInt('quantidade_vagas'))
    meta['salario_faixa'] = req.getString('faixa_salarial') || ''
    meta['tipo_contrato'] = tipoContratoName
    meta['cliente'] = clienteName
    meta['cargo'] = cargoName
    meta['cidade'] = cidadeName
    meta['especificacoes'] = req.getString('especificacoes') || ''

    var contentParts = []
    if (clienteName) contentParts.push('<p><strong>Cliente:</strong> ' + clienteName + '</p>')
    if (cargoName) contentParts.push('<p><strong>Cargo:</strong> ' + cargoName + '</p>')
    if (cidadeName) contentParts.push('<p><strong>Localização:</strong> ' + cidadeName + '</p>')
    if (req.getInt('quantidade_vagas') > 0)
      contentParts.push('<p><strong>Vagas:</strong> ' + req.getInt('quantidade_vagas') + '</p>')
    if (req.getString('faixa_salarial'))
      contentParts.push(
        '<p><strong>Faixa Salarial:</strong> ' + req.getString('faixa_salarial') + '</p>',
      )
    if (tipoContratoName)
      contentParts.push('<p><strong>Tipo de Contrato:</strong> ' + tipoContratoName + '</p>')
    for (var j = 0; j < pubFields.length; j++) {
      var v = req.getString(pubFields[j])
      if (v) {
        var label = pubFields[j].charAt(0).toUpperCase() + pubFields[j].slice(1)
        contentParts.push('<p><strong>' + label + ':</strong> ' + v + '</p>')
      }
    }
    if (req.getString('especificacoes'))
      contentParts.push(
        '<p><strong>Especificações:</strong> ' + req.getString('especificacoes') + '</p>',
      )

    var payload = {
      title: cargoName || req.getString('numero_oe') || 'Vaga',
      content: contentParts.join(''),
      status: 'draft',
      meta: meta,
    }

    var apiUrl = wpBaseUrl + '/wp-json/wp/v2/job_listings'

    var res
    try {
      res = $http.send({
        url: apiUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify(payload),
        timeout: 30,
      })
    } catch (err) {
      req.set('wordpress_sync_status', 'erro')
      req.set('wordpress_error_message', 'Erro de conexão: ' + (err.message || 'timeout'))
      $app.save(req)
      return e.json(500, { message: 'Erro de conexão com o WordPress' })
    }

    if (res.statusCode === 201 || res.statusCode === 200) {
      var jobId = ''
      try {
        jobId = String(res.json.id || '')
      } catch (_) {}

      if (!jobId) {
        req.set('wordpress_sync_status', 'erro')
        req.set('wordpress_error_message', 'Resposta do WordPress sem ID do post')
        $app.save(req)
        return e.json(500, { message: 'Resposta do WordPress sem ID do post' })
      }

      var adminUrl = wpBaseUrl + '/wp-admin/post.php?post=' + jobId + '&action=edit'
      var today = new Date().toISOString().split('T')[0]

      req.set('wordpress_job_id', jobId)
      req.set('wordpress_admin_url', adminUrl)
      req.set('wordpress_sync_status', 'sucesso')
      req.set('wordpress_sync_date', today)
      req.set('wordpress_error_message', '')
      req.set('status', 'Rascunho criado no WordPress')
      $app.save(req)

      return e.json(200, {
        ok: true,
        wordpress_job_id: jobId,
        wordpress_admin_url: adminUrl,
      })
    } else {
      var errorMsg = 'Erro ao criar rascunho (HTTP ' + res.statusCode + ')'
      try {
        if (res.json && res.json.message) errorMsg = String(res.json.message)
      } catch (_) {}

      req.set('wordpress_sync_status', 'erro')
      req.set('wordpress_error_message', errorMsg)
      $app.save(req)

      return e.json(res.statusCode, { message: errorMsg })
    }
  },
  $apis.requireAuth(),
)
