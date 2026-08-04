routerAdd(
  'POST',
  '/backend/v1/send-aviso-integracao-candidato',
  (e) => {
    const body = e.requestInfo().body || {}
    const candidateId = body.candidate_id
    if (!candidateId) return e.badRequestError('candidate_id é obrigatório')

    let candidate
    try {
      candidate = $app.findRecordById('candidates', candidateId)
    } catch (_) {
      return e.notFoundError('Candidato não encontrado')
    }

    const candidateNome = candidate.getString('nome') || 'Candidato'
    const candidateEmail = candidate.getString('email')
    if (!candidateEmail) return e.badRequestError('Candidato não possui e-mail cadastrado')

    const dataIntegracao = candidate.getString('data_integracao')
    const horaIntegracao = candidate.getString('hora_integracao') || ''
    const tipoIntegracao = candidate.getString('tipo_integracao') || ''

    let dataFormatada = ''
    if (dataIntegracao) {
      const datePart = dataIntegracao.split(' ')[0]
      const parts = datePart.split('-')
      if (parts.length === 3) {
        dataFormatada = parts[2] + '/' + parts[1] + '/' + parts[0]
      }
    }

    let vacancyName = 'Vaga PMais'
    const vacancyId = candidate.getString('vacancy_id')
    if (vacancyId) {
      try {
        const vacancy = $app.findRecordById('vacancies', vacancyId)
        const cargoId = vacancy.getString('cargo')
        let cargoNome = ''
        if (cargoId) {
          try {
            cargoNome = $app.findRecordById('cargos', cargoId).getString('nome')
          } catch (_) {}
        }
        if (cargoNome) vacancyName = cargoNome
      } catch (_) {}
    }

    let detalheIntegracao = ''
    if (tipoIntegracao === 'Presencial') {
      let baseNome = ''
      let baseEndereco = ''
      let baseTelefone = ''
      let baseContato = ''

      if (body.base_id) {
        try {
          const base = $app.findRecordById('base_integracao', body.base_id)
          baseNome = base.getString('nome') || ''
          baseEndereco = base.getString('endereco') || ''
          baseTelefone = base.getString('telefone') || ''
          baseContato = base.getString('pessoa_contato') || ''
        } catch (_) {}
      } else {
        try {
          const bases = $app.findRecordsByFilter('base_integracao', '', 'created', 1, 0)
          if (bases.length > 0) {
            baseNome = bases[0].getString('nome') || ''
            baseEndereco = bases[0].getString('endereco') || ''
            baseTelefone = bases[0].getString('telefone') || ''
            baseContato = bases[0].getString('pessoa_contato') || ''
          }
        } catch (_) {}
      }

      detalheIntegracao = '<p><strong>Tipo de Integração:</strong> Presencial</p>'
      if (dataFormatada) detalheIntegracao += '<p><strong>Data:</strong> ' + dataFormatada + '</p>'
      if (horaIntegracao)
        detalheIntegracao += '<p><strong>Horário:</strong> ' + horaIntegracao + '</p>'
      if (baseNome) detalheIntegracao += '<p><strong>Local:</strong> ' + baseNome + '</p>'
      if (baseEndereco)
        detalheIntegracao += '<p><strong>Endereço:</strong> ' + baseEndereco + '</p>'
      if (baseEndereco)
        detalheIntegracao +=
          '<p><a href="https://www.google.com/maps/search/?api=1&query=' +
          encodeURIComponent(baseEndereco) +
          '" target="_blank" style="color: #4f46e5; text-decoration: underline;">Ver no Google Maps</a></p>'
      if (baseTelefone)
        detalheIntegracao += '<p><strong>Telefone:</strong> ' + baseTelefone + '</p>'
      if (baseContato) detalheIntegracao += '<p><strong>Contato:</strong> ' + baseContato + '</p>'
    } else if (tipoIntegracao === 'On-line') {
      detalheIntegracao = '<p><strong>Tipo de Integração:</strong> On-line</p>'
      if (dataFormatada) detalheIntegracao += '<p><strong>Data:</strong> ' + dataFormatada + '</p>'
      if (horaIntegracao)
        detalheIntegracao += '<p><strong>Horário:</strong> ' + horaIntegracao + '</p>'
      detalheIntegracao +=
        '<p>As instruções e o link para acesso à integração online serão enviados em breve.</p>'
    } else {
      detalheIntegracao = '<p><strong>Data:</strong> ' + dataFormatada + '</p>'
      if (horaIntegracao)
        detalheIntegracao += '<p><strong>Horário:</strong> ' + horaIntegracao + '</p>'
    }

    let senderName = 'PMais RH'
    let senderEmail = 'vagas@pmaisservicos.com.br'
    let sloganPmais = ''
    try {
      const params = $app.findRecordsByFilter('system_parameters', '', 'created', 1, 0)
      if (params.length > 0) {
        const sp = params[0]
        if (sp.getString('nome_remetente')) senderName = sp.getString('nome_remetente')
        if (sp.getString('email_remetente')) senderEmail = sp.getString('email_remetente')
        sloganPmais = sp.getString('slogan_pmais') || ''
      }
    } catch (_) {}

    let subject = 'Aviso de Integração - PMais Terceirização'
    let bodyHtml = ''
    try {
      const templates = $app.findRecordsByFilter(
        'email_templates',
        'type = "aviso_integracao_candidato"',
        '',
        1,
        0,
      )
      if (templates.length > 0) {
        const template = templates[0]
        subject = template.getString('subject') || subject
        bodyHtml = template.getString('body') || ''
      }
    } catch (_) {}

    if (bodyHtml) {
      bodyHtml = bodyHtml.split('{{nome_candidato}}').join(candidateNome)
      bodyHtml = bodyHtml.split('{{nome}}').join(candidateNome)
      bodyHtml = bodyHtml.split('{{detalhes_integracao}}').join(detalheIntegracao)
      bodyHtml = bodyHtml.split('{{detalhe_integração}}').join(detalheIntegracao)
      bodyHtml = bodyHtml.split('{{detalhe_integracao}}').join(detalheIntegracao)
      bodyHtml = bodyHtml.split('{{vaga}}').join(vacancyName)
      bodyHtml = bodyHtml.split('{{data_integracao}}').join(dataFormatada)
      bodyHtml = bodyHtml.split('{{hora_integracao}}').join(horaIntegracao)
      bodyHtml = bodyHtml.split('{{tipo_integracao}}').join(tipoIntegracao)
    } else {
      bodyHtml = '<p>Olá ' + candidateNome + ',</p>'
      bodyHtml += '<p>Sua integração está agendada. Seguem os detalhes:</p>'
      bodyHtml += detalheIntegracao
      bodyHtml += '<p><strong>Vaga:</strong> ' + vacancyName + '</p>'
      bodyHtml += '<p>Atenciosamente,<br>Equipe RH PMais</p>'
    }

    subject = subject.split('{{vaga}}').join(vacancyName)
    subject = subject.split('{{nome_candidato}}').join(candidateNome)
    subject = subject.split('{{nome}}').join(candidateNome)
    subject = subject.split('{{data_integracao}}').join(dataFormatada)

    if (sloganPmais) {
      bodyHtml +=
        '<p style="text-align:center; color:#64748b; font-size:12px; margin-top:20px; padding-top:12px; border-top:1px solid #e2e8f0;">' +
        sloganPmais +
        '</p>'
    }

    let sendError = ''
    const resendKey = $secrets.get('RESEND_API_KEY')

    if (resendKey) {
      try {
        const res = $http.send({
          url: 'https://api.resend.com/emails',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + resendKey,
          },
          body: JSON.stringify({
            from: senderName + ' <' + senderEmail + '>',
            to: [candidateEmail],
            subject: subject,
            html: bodyHtml,
          }),
          timeout: 15,
        })

        if (res.statusCode >= 400) {
          sendError = 'Resend HTTP ' + res.statusCode + ': ' + JSON.stringify(res.json || res.body)
          $app
            .logger()
            .error(
              'Erro ao enviar aviso_integracao_candidato via Resend',
              'status',
              res.statusCode,
              'body',
              res.json,
            )
        }
      } catch (resendErr) {
        sendError = resendErr.message || String(resendErr)
        $app
          .logger()
          .error('Exceção ao chamar Resend API (aviso_integracao_candidato)', 'error', sendError)
      }
    } else {
      $app.logger().warn('RESEND_API_KEY não configurada para aviso_integracao_candidato')
    }

    try {
      const emailLogCol = $app.findCollectionByNameOrId('candidate_email_log')
      const logRecord = new Record(emailLogCol)
      logRecord.set('candidate_id', candidateId)
      logRecord.set('email_type', 'aviso_integracao_candidato')
      if (e.auth) {
        logRecord.set('sent_by', e.auth.id)
      }
      if (sendError) {
        logRecord.set('error_message', sendError)
      }
      $app.save(logRecord)
    } catch (logErr) {
      $app
        .logger()
        .error(
          'Erro ao gravar candidate_email_log (aviso_integracao_candidato)',
          'error',
          String(logErr),
        )
    }

    return e.json(200, { success: true, error: sendError || null })
  },
  $apis.requireAuth(),
)
