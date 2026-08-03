routerAdd(
  'POST',
  '/backend/v1/send-aviso-integracao-candidato',
  (e) => {
    try {
      const body = e.requestInfo().body || {}
      const candidateId = body.candidate_id || body.candidateId
      const baseIntegracaoId = body.base_integracao_id || body.baseIntegracaoId || ''

      if (!candidateId) {
        return e.badRequestError('O ID do candidato é obrigatório.')
      }

      const candidate = $app.findRecordById('candidates', candidateId)
      const candidateEmail = candidate.getString('email')

      if (!candidateEmail || !candidateEmail.trim()) {
        return e.badRequestError('Candidato não possui e-mail cadastrado.')
      }

      const tipoIntegracao = candidate.getString('tipo_integracao') || ''
      const dataIntegracao = candidate.getString('data_integracao') || ''
      const horaIntegracao = candidate.getString('hora_integracao') || ''
      const candidateNome = candidate.getString('nome') || 'Candidato'

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

      var dataFormatada = dataIntegracao
      if (dataIntegracao) {
        var parts = dataIntegracao.split('-')
        if (parts.length === 3) {
          dataFormatada = parts[2] + '/' + parts[1] + '/' + parts[0]
        }
      }

      var subject = 'Informações sobre sua Integração - PMais'
      var bodyHtml = ''

      if (tipoIntegracao === 'On-line') {
        bodyHtml =
          '<p>Olá <strong>' +
          candidateNome +
          '</strong>,</p>' +
          '<p>Sua integração para a vaga de <strong>' +
          vacancyName +
          '</strong> está agendada para <strong>' +
          dataFormatada +
          '</strong> às <strong>' +
          horaIntegracao +
          '</strong>.</p>' +
          '<p>O link para a reunião online será enviado por este e-mail alguns minutos antes do horário agendado.</p>' +
          '<p>Atenciosamente,<br>Equipe RH PMais</p>'
      } else {
        var baseNome = 'Base de Integração'
        var baseEndereco = ''
        var baseTelefone = ''
        var baseContato = ''

        if (baseIntegracaoId) {
          try {
            var base = $app.findRecordById('base_integracao', baseIntegracaoId)
            baseNome = base.getString('nome') || baseNome
            baseEndereco = base.getString('endereco') || ''
            baseTelefone = base.getString('telefone') || ''
            baseContato = base.getString('pessoa_contato') || ''
          } catch (_) {}
        }

        var mapsLink = ''
        if (baseEndereco) {
          mapsLink = 'https://maps.google.com/?q=' + encodeURIComponent(baseEndereco)
        }

        bodyHtml =
          '<p>Olá <strong>' +
          candidateNome +
          '</strong>,</p>' +
          '<p>Sua integração para a vaga de <strong>' +
          vacancyName +
          '</strong> está agendada para <strong>' +
          dataFormatada +
          '</strong> às <strong>' +
          horaIntegracao +
          '</strong>.</p>' +
          '<p><strong>Local:</strong> ' +
          baseNome +
          '<br>'
        if (baseEndereco) bodyHtml += '<strong>Endereço:</strong> ' + baseEndereco + '<br>'
        if (baseTelefone) bodyHtml += '<strong>Telefone:</strong> ' + baseTelefone + '<br>'
        if (baseContato) bodyHtml += '<strong>Contato:</strong> ' + baseContato + '<br>'
        bodyHtml += '</p>'
        if (mapsLink) {
          bodyHtml +=
            '<p><a href="' +
            mapsLink +
            '" target="_blank" rel="noopener noreferrer">Ver localização no Google Maps</a></p>'
        }
        bodyHtml += '<p>Atenciosamente,<br>Equipe RH PMais</p>'
      }

      var sloganPmais = ''
      try {
        var spParams = $app.findRecordsByFilter('system_parameters', '', 'created', 1, 0)
        if (spParams.length > 0) {
          sloganPmais = spParams[0].getString('slogan_pmais') || ''
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
              from: 'PMais RH <vagas@pmaisservicos.com.br>',
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
          $app.logger().error('Exceção ao chamar Resend API', 'error', sendError)
        }
      } else {
        $app.logger().warn('RESEND_API_KEY não configurada')
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
        message: 'Aviso de integração enviado para ' + candidateEmail,
      })
    } catch (err) {
      $app.logger().error('Erro na rota send-aviso-integracao-candidato', 'error', String(err))
      return e.badRequestError(err.message || 'Erro ao enviar aviso de integração.')
    }
  },
  $apis.requireAuth(),
)
