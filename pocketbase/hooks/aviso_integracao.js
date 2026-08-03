onRecordAfterUpdateSuccess((e) => {
  var record = e.record

  var oldVal = false
  var newVal = record.getBool('integracao_ativa')

  try {
    oldVal = record.original().getBool('integracao_ativa')
  } catch (_) {
    e.next()
    return
  }

  if (oldVal === newVal || !newVal) {
    e.next()
    return
  }

  try {
    $app.findFirstRecordByFilter(
      'candidate_email_log',
      'candidate_id = "' + record.id + '" && email_type = "aviso_integracao"',
    )
    e.next()
    return
  } catch (_) {}

  var emailDpLista = ''
  var emailOperacionalLista = ''
  var emailComercial = ''
  var senderName = 'PMais RH'
  var senderEmail = 'vagas@pmaisservicos.com.br'
  var sloganPmais = ''

  try {
    var params = $app.findRecordsByFilter('system_parameters', '', 'created', 1, 0)
    if (params.length > 0) {
      var sp = params[0]
      emailDpLista = sp.getString('email_dp_lista') || ''
      emailOperacionalLista = sp.getString('email_operacional_lista') || ''
      emailComercial = sp.getString('email_comercial') || ''
      if (sp.getString('nome_remetente')) senderName = sp.getString('nome_remetente')
      if (sp.getString('email_remetente')) senderEmail = sp.getString('email_remetente')
      sloganPmais = sp.getString('slogan_pmais') || ''
    }
  } catch (_) {}

  var dpEmails = emailDpLista
    ? emailDpLista
        .split(',')
        .map(function (s) {
          return s.trim()
        })
        .filter(function (s) {
          return s.length > 0
        })
    : []
  var opEmails = emailOperacionalLista
    ? emailOperacionalLista
        .split(',')
        .map(function (s) {
          return s.trim()
        })
        .filter(function (s) {
          return s.length > 0
        })
    : []
  var comEmails = emailComercial
    ? emailComercial
        .split(',')
        .map(function (s) {
          return s.trim()
        })
        .filter(function (s) {
          return s.length > 0
        })
    : []

  if (dpEmails.length === 0 && opEmails.length === 0 && comEmails.length === 0) {
    e.next()
    return
  }

  var toRecipients = []
  var ccRecipients = []

  if (dpEmails.length > 0) {
    toRecipients.push(dpEmails[0])
    for (var i = 1; i < dpEmails.length; i++) ccRecipients.push(dpEmails[i])
  }
  if (opEmails.length > 0) {
    toRecipients.push(opEmails[0])
    for (var j = 1; j < opEmails.length; j++) ccRecipients.push(opEmails[j])
  }
  if (comEmails.length > 0) {
    toRecipients.push(comEmails[0])
    for (var k = 1; k < comEmails.length; k++) ccRecipients.push(comEmails[k])
  }

  var candidateNome = record.getString('nome') || 'Candidato'
  var vacancyName = 'Vaga PMais'
  var vacancyId = record.getString('vacancy_id')
  if (vacancyId) {
    try {
      var vacancy = $app.findRecordById('vacancies', vacancyId)
      var cargoId = vacancy.getString('cargo')
      var cargoNome = ''
      if (cargoId) {
        try {
          cargoNome = $app.findRecordById('cargos', cargoId).getString('nome')
        } catch (_) {}
      }
      if (cargoNome) vacancyName = cargoNome
    } catch (_) {}
  }

  var subject = 'Novo Candidato para Integração - PMais Terceirização'
  var bodyHtml =
    '<p>Olá,</p>' +
    '<p>Um novo candidato entrou na página de integração para ser devidamente integrado e se tornar o mais novo membro da equipe PMais Terceirização.</p>' +
    '<p><strong>Candidato:</strong> ' +
    candidateNome +
    '</p>' +
    '<p><strong>Vaga:</strong> ' +
    vacancyName +
    '</p>' +
    '<p>Por favor, providenciem as devidas orientações para a integração.</p>' +
    '<p>Atenciosamente,<br>Equipe RH PMais</p>'

  if (sloganPmais) {
    bodyHtml +=
      '<p style="text-align:center; color:#64748b; font-size:12px; margin-top:20px; padding-top:12px; border-top:1px solid #e2e8f0;">' +
      sloganPmais +
      '</p>'
  }

  var sendError = ''
  var resendKey = $secrets.get('RESEND_API_KEY')

  if (resendKey && toRecipients.length > 0) {
    try {
      var emailPayload = {
        from: senderName + ' <' + senderEmail + '>',
        to: toRecipients,
        subject: subject,
        html: bodyHtml,
      }
      if (ccRecipients.length > 0) {
        emailPayload.cc = ccRecipients
      }

      var res = $http.send({
        url: 'https://api.resend.com/emails',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + resendKey,
        },
        body: JSON.stringify(emailPayload),
        timeout: 15,
      })

      if (res.statusCode >= 400) {
        sendError = 'Resend HTTP ' + res.statusCode + ': ' + JSON.stringify(res.json || res.body)
        $app
          .logger()
          .error(
            'Erro ao enviar aviso_integracao via Resend',
            'status',
            res.statusCode,
            'body',
            res.json,
          )
      }
    } catch (resendErr) {
      sendError = resendErr.message || String(resendErr)
      $app.logger().error('Exceção ao chamar Resend API (aviso_integracao)', 'error', sendError)
    }
  } else {
    if (!resendKey) $app.logger().warn('RESEND_API_KEY não configurada para aviso_integracao')
  }

  try {
    var emailLogCol = $app.findCollectionByNameOrId('candidate_email_log')
    var logRecord = new Record(emailLogCol)
    logRecord.set('candidate_id', record.id)
    logRecord.set('email_type', 'aviso_integracao')
    if (sendError) {
      logRecord.set('error_message', sendError)
    }
    $app.save(logRecord)
  } catch (logErr) {
    $app
      .logger()
      .error('Erro ao gravar candidate_email_log (aviso_integracao)', 'error', String(logErr))
  }

  e.next()
}, 'candidates')
