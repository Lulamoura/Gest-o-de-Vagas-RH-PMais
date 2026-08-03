routerAdd(
  'POST',
  '/backend/v1/send-aviso-integracao-candidato',
  (e) => {
    try {
      var body = e.requestInfo().body || {}
      var candidateId = body.candidate_id || body.candidateId
      if (!candidateId) return e.badRequestError('ID do candidato é obrigatório.')

      var candidate = $app.findRecordById('candidates', candidateId)
      var candidateEmail = candidate.getString('email')
      if (!candidateEmail || !candidateEmail.trim())
        return e.badRequestError('Candidato não possui e-mail cadastrado.')

      var vacancyName = 'Vaga PMais'
      var vacancyId = candidate.getString('vacancy_id')
      if (vacancyId) {
        try {
          var vacancy = $app.findRecordById('vacancies', vacancyId)
          var cargoId = vacancy.getString('cargo')
          if (cargoId) {
            try {
              vacancyName = $app.findRecordById('cargos', cargoId).getString('nome')
            } catch (_) {}
          }
        } catch (_) {}
      }

      var dataIntegracao = candidate.getString('data_nascimento')
        ? candidate.getString('data_integracao')
        : candidate.getString('data_integracao')
      var horaIntegracao = candidate.getString('hora_integracao')
      var tipoIntegracao = candidate.getString('tipo_integracao') || 'Presencial'

      var baseNome = '',
        baseEndereco = '',
        baseTelefone = '',
        baseContato = ''
      if (tipoIntegracao === 'Presencial' && body.base_integracao_id) {
        try {
          var base = $app.findRecordById('base_integracao', body.base_integracao_id)
          baseNome = base.getString('nome')
          baseEndereco = base.getString('endereco')
          baseTelefone = base.getString('telefone')
          baseContato = base.getString('pessoa_contato')
        } catch (_) {}
      }

      var siteUrl = $secrets.get('SITE_URL') || 'https://vagaspmais.pmaisservicos.com.br'
      if (siteUrl.endsWith('/')) siteUrl = siteUrl.slice(0, -1)

      var subject = 'Aviso de Integração - PMais'
      var bodyHtml =
        '<p>Olá <strong>{{nome}}</strong>,</p>' +
        '<p>Sua integração para a vaga de <strong>{{vaga}}</strong> está agendada.</p>' +
        '<p><strong>Data:</strong> {{data_integracao}}<br>' +
        '<strong>Hora:</strong> {{hora_integracao}}<br>' +
        '<strong>Tipo:</strong> {{tipo_integracao}}</p>' +
        '{{base_info}}' +
        '<p>Atenciosamente,<br>Equipe RH PMais</p>'

      try {
        var template = $app.findFirstRecordByData(
          'email_templates',
          'type',
          'aviso_integracao_candidato',
        )
        if (template.getString('subject')) subject = template.getString('subject')
        if (template.getString('body')) bodyHtml = template.getString('body')
      } catch (_) {}

      var baseInfoHtml = ''
      if (tipoIntegracao === 'Presencial' && baseNome) {
        baseInfoHtml = '<p><strong>Local de Integração:</strong><br>' + baseNome
        if (baseEndereco) baseInfoHtml += '<br>' + baseEndereco
        if (baseTelefone) baseInfoHtml += '<br>Telefone: ' + baseTelefone
        if (baseContato) baseInfoHtml += '<br>Contato: ' + baseContato
        baseInfoHtml += '</p>'
        if (baseEndereco) {
          baseInfoHtml +=
            '<p><a href="https://www.google.com/maps/search/?api=1&query=' +
            encodeURIComponent(baseEndereco) +
            '">Ver no Google Maps</a></p>'
        }
      } else if (tipoIntegracao === 'On-line') {
        baseInfoHtml =
          '<p><strong>Modalidade:</strong> On-line<br>O link de acesso será enviado em breve.</p>'
      }

      var candidateNome = candidate.getString('nome') || 'Candidato'
      var replacements = {
        nome: candidateNome,
        vaga: vacancyName,
        data_integracao: dataIntegracao || 'A definir',
        hora_integracao: horaIntegracao || 'A definir',
        tipo_integracao: tipoIntegracao,
        base_nome: baseNome,
        base_endereco: baseEndereco,
        base_telefone: baseTelefone,
        base_contato: baseContato,
        base_info: baseInfoHtml,
        link: siteUrl,
        company_name: 'PMais Terceirização',
      }
      for (var key in replacements) {
        var val = replacements[key]
        subject = subject
          .replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), val)
          .replace(new RegExp('\\{' + key + '\\}', 'g'), val)
        bodyHtml = bodyHtml
          .replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), val)
          .replace(new RegExp('\\{' + key + '\\}', 'g'), val)
      }

      var sloganPmais = ''
      try {
        var spParams = $app.findRecordsByFilter('system_parameters', '', 'created', 1, 0)
        if (spParams.length > 0) sloganPmais = spParams[0].getString('slogan_pmais') || ''
      } catch (_) {}
      if (sloganPmais) {
        bodyHtml +=
          '<p style="text-align:center; color:#64748b; font-size:12px; margin-top:20px; padding-top:12px; border-top:1px solid #e2e8f0;">' +
          sloganPmais +
          '</p>'
      }

      var senderName = 'PMais RH'
      var senderEmail = 'vagas@pmaisservicos.com.br'
      try {
        var sp = $app.findRecordsByFilter('system_parameters', '', 'created', 1, 0)
        if (sp.length > 0) {
          if (sp[0].getString('nome_remetente')) senderName = sp[0].getString('nome_remetente')
          if (sp[0].getString('email_remetente')) senderEmail = sp[0].getString('email_remetente')
        }
      } catch (_) {}

      var sendError = ''
      var resendKey = $secrets.get('RESEND_API_KEY')
      if (resendKey) {
        try {
          var res = $http.send({
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
            sendError =
              'Resend HTTP ' + res.statusCode + ': ' + JSON.stringify(res.json || res.body)
            $app
              .logger()
              .error(
                'Erro ao enviar aviso_integracao_candidato',
                'status',
                res.statusCode,
                'body',
                res.json,
              )
          }
        } catch (resendErr) {
          sendError = resendErr.message || String(resendErr)
          $app.logger().error('Exceção Resend (aviso_integracao_candidato)', 'error', sendError)
        }
      } else {
        $app.logger().warn('RESEND_API_KEY não configurada para aviso_integracao_candidato')
      }

      try {
        var emailLogCol = $app.findCollectionByNameOrId('candidate_email_log')
        var logRecord = new Record(emailLogCol)
        logRecord.set('candidate_id', candidate.id)
        logRecord.set('email_type', 'aviso_integracao_candidato')
        if (e.auth) logRecord.set('sent_by', e.auth.id)
        if (sendError) logRecord.set('error_message', sendError)
        $app.save(logRecord)
      } catch (logErr) {
        $app
          .logger()
          .error('Erro ao gravar log (aviso_integracao_candidato)', 'error', String(logErr))
      }

      return e.json(200, {
        success: true,
        message: 'Aviso de integração enviado para ' + candidateEmail,
      })
    } catch (err) {
      $app.logger().error('Erro em send-aviso-integracao-candidato', 'error', String(err))
      return e.badRequestError(err.message || 'Erro ao enviar aviso.')
    }
  },
  $apis.requireAuth(),
)
