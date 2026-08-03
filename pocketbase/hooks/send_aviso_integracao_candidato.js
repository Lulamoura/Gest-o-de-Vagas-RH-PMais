routerAdd(
  'POST',
  '/backend/v1/send-aviso-integracao-candidato',
  (e) => {
    try {
      const body = e.requestInfo().body || {}
      const candidateId = body.candidate_id || body.candidateId
      const tipoIntegracao = body.tipo_integracao || ''
      const baseIntegracaoId = body.base_integracao_id || body.baseIntegracaoId || ''

      if (!candidateId) {
        return e.badRequestError('O ID do candidato \u00e9 obrigat\u00f3rio.')
      }

      const candidate = $app.findRecordById('candidates', candidateId)
      const candidateEmail = candidate.getString('email')

      if (!candidateEmail || !candidateEmail.trim()) {
        return e.badRequestError('Candidato n\u00e3o possui e-mail cadastrado.')
      }

      var vacancyName = 'Vaga PMais'
      const vacancyId = candidate.getString('vacancy_id')
      if (vacancyId) {
        try {
          const vacancy = $app.findRecordById('vacancies', vacancyId)
          const cargoId = vacancy.getString('cargo')
          if (cargoId) {
            try {
              vacancyName = $app.findRecordById('cargos', cargoId).getString('nome')
            } catch (_) {}
          }
        } catch (_) {}
      }

      var dataIntegracao = candidate.getString('data_integracao') || ''
      var horaIntegracao = candidate.getString('hora_integracao') || ''

      var formattedDate = dataIntegracao
      if (dataIntegracao) {
        try {
          var d = new Date(dataIntegracao + 'T00:00:00')
          formattedDate =
            String(d.getUTCDate()).padStart(2, '0') +
            '/' +
            String(d.getUTCMonth() + 1).padStart(2, '0') +
            '/' +
            d.getUTCFullYear()
        } catch (_) {}
      }

      var detalhesIntegracao = ''
      if (tipoIntegracao === 'On-line') {
        detalhesIntegracao =
          '<p>O link para a reuni\u00e3o online ser\u00e1 enviado por e-mail alguns minutos antes do hor\u00e1rio agendado.</p>'
      } else if (tipoIntegracao === 'Presencial' && baseIntegracaoId) {
        try {
          var base = $app.findRecordById('base_integracao', baseIntegracaoId)
          var baseNome = base.getString('nome') || ''
          var baseEndereco = base.getString('endereco') || ''
          var baseTelefone = base.getString('telefone') || ''
          var baseContato = base.getString('pessoa_contato') || ''

          var mapsLink = ''
          if (baseEndereco) {
            mapsLink = 'https://maps.google.com/?q=' + encodeURIComponent(baseEndereco)
          }

          detalhesIntegracao =
            '<p><strong>Local de Integra\u00e7\u00e3o:</strong> ' + baseNome + '</p>'
          if (baseEndereco)
            detalhesIntegracao += '<p><strong>Endere\u00e7o:</strong> ' + baseEndereco + '</p>'
          if (baseTelefone)
            detalhesIntegracao += '<p><strong>Telefone:</strong> ' + baseTelefone + '</p>'
          if (baseContato)
            detalhesIntegracao += '<p><strong>Pessoa de Contato:</strong> ' + baseContato + '</p>'
          if (mapsLink)
            detalhesIntegracao +=
              '<p><a href="' +
              mapsLink +
              '" target="_blank" rel="noopener noreferrer">Ver localiza\u00e7\u00e3o no Google Maps</a></p>'
        } catch (_) {
          detalhesIntegracao =
            '<p>Por favor, entre em contato com o RH para obter os detalhes do local de integra\u00e7\u00e3o.</p>'
        }
      }

      var subject = 'Informa\u00e7\u00f5es sobre sua Integra\u00e7\u00e3o - ' + vacancyName
      var bodyHtml =
        '<p>Ol\u00e1 <strong>{{nome}}</strong>,</p>' +
        '<p>Sua integra\u00e7\u00e3o para a vaga de <strong>{{vaga}}</strong> est\u00e1 agendada.</p>' +
        '<p><strong>Data:</strong> {{data_integracao}}<br>' +
        '<strong>Hora:</strong> {{hora_integracao}}<br>' +
        '<strong>Tipo:</strong> {{tipo_integracao}}</p>' +
        '{{detalhes_integracao}}' +
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

      var candidateNome = candidate.getString('nome') || 'Candidato'
      var replacements = {
        nome: candidateNome,
        nome_candidato: candidateNome,
        candidate_name: candidateNome,
        vaga: vacancyName,
        vacancy_name: vacancyName,
        data_integracao: formattedDate,
        hora_integracao: horaIntegracao,
        tipo_integracao: tipoIntegracao,
        detalhes_integracao: detalhesIntegracao,
        company_name: 'PMais Terceiriza\u00e7\u00e3o',
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

      var senderName = 'PMais RH'
      var senderEmail = 'vagas@pmaisservicos.com.br'
      var sloganPmais = ''
      try {
        var params = $app.findRecordsByFilter('system_parameters', '', 'created', 1, 0)
        if (params.length > 0) {
          var sp = params[0]
          if (sp.getString('nome_remetente')) senderName = sp.getString('nome_remetente')
          if (sp.getString('email_remetente')) senderEmail = sp.getString('email_remetente')
          sloganPmais = sp.getString('slogan_pmais') || ''
        }
      } catch (_) {}

      if (sloganPmais) {
        bodyHtml +=
          '<p style="text-align:center; color:#64748b; font-size:12px; margin-top:20px; padding-top:12px; border-top:1px solid #e2e8f0;">' +
          sloganPmais +
          '</p>'
      }

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
              .error('Erro ao enviar e-mail via Resend', 'status', res.statusCode, 'body', res.json)
          }
        } catch (resendErr) {
          sendError = resendErr.message || String(resendErr)
          $app.logger().error('Exce\u00e7\u00e3o ao chamar Resend API', 'error', sendError)
        }
      } else {
        $app.logger().warn('RESEND_API_KEY n\u00e3o configurada')
      }

      try {
        var emailLogCol = $app.findCollectionByNameOrId('candidate_email_log')
        var logRecord = new Record(emailLogCol)
        logRecord.set('candidate_id', candidate.id)
        logRecord.set('email_type', 'aviso_integracao_candidato')
        if (e.auth) {
          logRecord.set('sent_by', e.auth.id)
        }
        if (sendError) {
          logRecord.set('error_message', sendError)
        }
        $app.save(logRecord)
      } catch (logErr) {
        $app.logger().error('Erro ao gravar candidate_email_log', 'error', String(logErr))
      }

      return e.json(200, {
        success: true,
        message: 'Aviso de integra\u00e7\u00e3o enviado para ' + candidateEmail,
      })
    } catch (err) {
      $app.logger().error('Erro na rota send-aviso-integracao-candidato', 'error', String(err))
      return e.badRequestError(err.message || 'Erro ao enviar aviso de integra\u00e7\u00e3o.')
    }
  },
  $apis.requireAuth(),
)
