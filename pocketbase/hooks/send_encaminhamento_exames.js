routerAdd(
  'POST',
  '/backend/v1/send-encaminhamento-exames',
  (e) => {
    try {
      const info = e.requestInfo()
      const body = info.body || {}
      const candidateId = body.candidate_id || body.candidateId
      const clinicaId = body.clinica_id || body.clinicaId
      const comentario = body.comentario || ''
      const custoExames = Number(body.custo_exames || body.custoExames || 0)

      if (!candidateId) {
        return e.badRequestError('O ID do candidato é obrigatório.')
      }

      const candidate = $app.findRecordById('candidates', candidateId)
      const candidateEmail = candidate.getString('email')

      if (!candidateEmail || !candidateEmail.trim()) {
        return e.badRequestError('Candidato não possui e-mail cadastrado.')
      }

      let clinicaNome = 'Clínica Ocupacional'
      let clinicaEndereco = ''
      let clinicaTelefone = ''
      let clinicaEmail = ''
      let clinicaContato = ''

      if (clinicaId) {
        try {
          const clinica = $app.findRecordById('clinicas', clinicaId)
          clinicaNome = clinica.getString('nome') || clinicaNome
          clinicaEndereco = clinica.getString('endereco') || ''
          clinicaTelefone = clinica.getString('telefone') || ''
          clinicaEmail = clinica.getString('email') || ''
          clinicaContato = clinica.getString('pessoa_contato') || ''
        } catch (errClinic) {
          $app.logger().warn('Clínica não encontrada', 'clinicaId', clinicaId)
        }
      }

      var mapsLinkHtml = ''
      if (clinicaEndereco && clinicaEndereco.trim()) {
        var mapsUrl =
          'https://www.google.com/maps/search/?api=1&query=' +
          encodeURIComponent(clinicaEndereco.trim())
        mapsLinkHtml =
          '<p><a href="' +
          mapsUrl +
          '" target="_blank" rel="noopener noreferrer">Ver localização no Google Maps</a></p>'
      }

      if (custoExames > 0) {
        const currentCost = candidate.getFloat('custo_exames') || 0
        candidate.set('custo_exames', currentCost + custoExames)
        $app.save(candidate)
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

      let subject = 'Encaminhamento para Exames Ocupacionais - PMais'
      let bodyHtml =
        '<p>Olá <strong>{{nome}}</strong>,</p><p>Você foi encaminhado(a) para exames ocupacionais para a vaga de <strong>{{vaga}}</strong>.</p><p><strong>Clínica:</strong> {{clinica_nome}}<br><strong>Endereço:</strong> {{clinica_endereco}}<br><strong>Telefone:</strong> {{clinica_telefone}}</p>{{maps_link_html}}<p><strong>Orientações:</strong><br>{{comentario}}</p><p>Atenciosamente,<br>Equipe RH PMais</p>'

      try {
        const template = $app.findFirstRecordByData(
          'email_templates',
          'type',
          'encaminhamento_exames',
        )
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
        clinica_nome: clinicaNome,
        clinica_endereco: clinicaEndereco,
        clinica_telefone: clinicaTelefone,
        clinica_email: clinicaEmail,
        clinica_contato: clinicaContato,
        comentario: comentario,
        observacao: comentario,
        maps_link_html: mapsLinkHtml,
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

      if (mapsLinkHtml && bodyHtml.indexOf('google.com/maps') === -1) {
        if (clinicaEndereco && bodyHtml.indexOf(clinicaEndereco) !== -1) {
          var addrIdx = bodyHtml.indexOf(clinicaEndereco)
          var closePIdx = bodyHtml.indexOf('</p>', addrIdx)
          if (closePIdx !== -1) {
            bodyHtml =
              bodyHtml.substring(0, closePIdx + 4) +
              mapsLinkHtml +
              bodyHtml.substring(closePIdx + 4)
          } else {
            bodyHtml = mapsLinkHtml + bodyHtml
          }
        } else {
          bodyHtml = mapsLinkHtml + bodyHtml
        }
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
          $app.logger().error('Exceção ao chamar Resend API', 'error', sendError)
        }
      } else {
        $app.logger().warn('RESEND_API_KEY não configurada')
      }

      try {
        const emailLogCol = $app.findCollectionByNameOrId('candidate_email_log')
        const logRecord = new Record(emailLogCol)
        logRecord.set('candidate_id', candidate.id)
        logRecord.set('email_type', 'encaminhamento_exames')
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
        message: 'Encaminhamento de exames enviado para ' + candidateEmail,
      })
    } catch (err) {
      $app.logger().error('Erro na rota send-encaminhamento-exames', 'error', String(err))
      return e.badRequestError(err.message || 'Erro ao enviar encaminhamento para exames.')
    }
  },
  $apis.requireAuth(),
)
