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

  var emailDp = ''
  var emailOperacional = ''
  var senderName = 'PMais RH'
  var senderEmail = 'vagas@pmaisservicos.com.br'
  var sloganPmais = ''

  try {
    var params = $app.findRecordsByFilter('system_parameters', '', 'created', 1, 0)
    if (params.length > 0) {
      var sp = params[0]
      emailDp = sp.getString('email_dp') || ''
      emailOperacional = sp.getString('email_operacional') || ''
      if (sp.getString('nome_remetente')) senderName = sp.getString('nome_remetente')
      if (sp.getString('email_remetente')) senderEmail = sp.getString('email_remetente')
      sloganPmais = sp.getString('slogan_pmais') || ''
    }
  } catch (_) {}

  if (!emailDp && !emailOperacional) {
    e.next()
    return
  }

  var candidateNome = record.getString('nome') || 'Candidato'
  var vacancyName = 'Vaga PMais'
  var vacancyId = record.getString('vacancy_id')
  if (vacancyId) {
    try {
      var vacancy = $app.findRecordById('vacancies', vacancyId)
      var cargoId = vacancy.getString('cargo')
      var clienteId = vacancy.getString('cliente')
      var cargoNome = ''
      var clienteNome = ''
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

  var recipients = []
  if (emailDp) recipients.push(emailDp)
  if (emailOperacional) recipients.push(emailOperacional)

  var sendError = ''
  var resendKey = $secrets.get('RESEND_API_KEY')

  if (resendKey && recipients.length > 0) {
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
          to: recipients,
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
