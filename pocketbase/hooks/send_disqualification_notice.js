routerAdd(
  'POST',
  '/backend/v1/send-disqualification-notice',
  (e) => {
    try {
      const info = e.requestInfo()
      const body = info.body || {}
      const candidateId = body.candidate_id || body.candidateId

      if (!candidateId) {
        return e.badRequestError('O ID do candidato é obrigatório.')
      }

      const candidate = $app.findRecordById('candidates', candidateId)
      const candidateEmail = candidate.getString('email')

      if (!candidateEmail || !candidateEmail.trim()) {
        return e.badRequestError('Candidato não possui e-mail cadastrado.')
      }

      let vacancyName = 'Vaga PMais'
      const vacancyId = candidate.getString('vacancy_id')
      if (vacancyId) {
        try {
          const vacancy = $app.findRecordById('vacancies', vacancyId)
          const cargoId = vacancy.getString('cargo')
          const clienteId = vacancy.getString('cliente')
          let cargoNome = ''
          let clienteNome = ''
          if (cargoId) {
            try {
              cargoNome = $app.findRecordById('cargos', cargoId).getString('nome')
            } catch (_) {}
          }
          if (clienteId) {
            try {
              clienteNome = $app.findRecordById('clientes', clienteId).getString('nome')
            } catch (_) {}
          }
          if (cargoNome && clienteNome) vacancyName = cargoNome + ' - ' + clienteNome
          else if (cargoNome) vacancyName = cargoNome
          else if (clienteNome) vacancyName = clienteNome
        } catch (_) {}
      }

      let subject = 'Atualização sobre o Processo Seletivo - PMais'
      let bodyHtml =
        '<p>Olá <strong>{{nome}}</strong>,</p><p>Agradecemos seu interesse na vaga de <strong>{{vaga}}</strong>.</p><p>Neste momento, optamos por seguir com outro perfil para esta oportunidade. Manteremos seu currículo em nosso banco de talentos para futuras vagas.</p><p>Atenciosamente,<br>Equipe RH PMais</p>'

      try {
        const template = $app.findFirstRecordByData('email_templates', 'type', 'disqualification')
        if (template.getString('subject')) subject = template.getString('subject')
        if (template.getString('body')) bodyHtml = template.getString('body')
      } catch (_) {}

      const candidateNome = candidate.getString('nome') || 'Candidato'
      var replacements = {
        nome: candidateNome,
        nome_candidato: candidateNome,
        candidate_name: candidateNome,
        vaga: vacancyName,
        vacancy_name: vacancyName,
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
        if (spParams.length > 0) {
          sloganPmais = spParams[0].getString('slogan_pmais') || ''
        }
      } catch (_) {}

      if (sloganPmais) {
        bodyHtml =
          bodyHtml +
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
        const emailLogCol = $app.findCollectionByNameOrId('candidate_email_log')
        const logRecord = new Record(emailLogCol)
        logRecord.set('candidate_id', candidate.id)
        logRecord.set('email_type', 'disqualification')
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
        message: 'Aviso de desclassificação enviado para ' + candidateEmail,
      })
    } catch (err) {
      $app.logger().error('Erro na rota send-disqualification-notice', 'error', String(err))
      return e.badRequestError(err.message || 'Erro ao enviar aviso.')
    }
  },
  $apis.requireAuth(),
)
