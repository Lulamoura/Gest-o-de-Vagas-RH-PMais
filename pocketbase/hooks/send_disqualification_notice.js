routerAdd(
  'POST',
  '/backend/v1/send-disqualification-notice',
  (e) => {
    const body = e.requestInfo().body || {}
    const candidateId = body.candidate_id || ''
    if (!candidateId) return e.badRequestError('candidate_id é obrigatório')

    try {
      const candidate = $app.findRecordById('candidates', candidateId)
      const candidateEmail = candidate.getString('email')
      if (!candidateEmail) return e.badRequestError('Candidato não possui email cadastrado')

      const candidateStatus = candidate.getString('status_candidato')
      if (candidateStatus !== 'Desclassificado' && candidateStatus !== 'Em banco') {
        return e.badRequestError('Candidato não está desclassificado ou em banco')
      }

      const vacancyId = candidate.getString('vacancy_id')
      var vacancyTitle = 'Vaga'
      if (vacancyId) {
        try {
          var vacancy = $app.findRecordById('vacancies', vacancyId)
          var cargoId = vacancy.getString('cargo')
          if (cargoId) {
            try {
              var cargo = $app.findRecordById('cargos', cargoId)
              vacancyTitle = cargo.getString('nome')
            } catch (_) {}
          }
        } catch (_) {}
      }

      var candidateName = candidate.getString('nome')
      var companyName = 'PMais Terceirização'

      var defaultSubject = 'Aviso de Desclassicação – ' + vacancyTitle
      var defaultBody =
        '<p>Olá ' +
        candidateName +
        ',</p>' +
        '<p>Agradecemos sua participação no processo seletivo para a vaga de <strong>' +
        vacancyTitle +
        '</strong> na ' +
        companyName +
        '.</p>' +
        '<p>Informamos que, desta vez, você não foi classificado(a) para a vaga em questão.</p>' +
        '<p>No entanto, seus dados permanecerão em nosso banco de talentos e poderão ser considerados para futuras oportunidades que sejam compatíveis com seu perfil profissional.</p>' +
        '<p>Agradecemos seu interesse e desejamos sucesso em sua trajetória.</p>' +
        '<p>Atenciosamente,<br><strong>RH da ' +
        companyName +
        '.</strong></p>'

      var emailSubject = defaultSubject
      var emailBody = defaultBody

      try {
        var template = $app.findFirstRecordByData('email_templates', 'type', 'disqualification')
        if (template) {
          var tplSubject = template.getString('subject')
          var tplBody = template.getString('body')
          if (tplSubject && tplBody) {
            emailSubject = tplSubject
              .replace(/\{candidate_name\}/g, candidateName)
              .replace(/\{vacancy_name\}/g, vacancyTitle)
              .replace(/\{company_name\}/g, companyName)
            emailBody = tplBody
              .replace(/\{candidate_name\}/g, candidateName)
              .replace(/\{vacancy_name\}/g, vacancyTitle)
              .replace(/\{company_name\}/g, companyName)
          }
        }
      } catch (_) {}

      var apiKey = $secrets.get('RESEND_API_KEY')
      if (!apiKey) return e.json(500, { error: 'RESEND_API_KEY não configurado' })

      var res = $http.send({
        url: 'https://api.resend.com/emails',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apiKey,
        },
        body: JSON.stringify({
          from: 'nao-responda@pmaisservicos.com.br',
          to: candidateEmail,
          subject: emailSubject,
          html: emailBody,
        }),
        timeout: 30,
      })

      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          var logCol = $app.findCollectionByNameOrId('candidate_email_log')
          var logRecord = new Record(logCol)
          logRecord.set('candidate_id', candidateId)
          logRecord.set('email_type', 'disqualification')
          logRecord.set('sent_by', e.auth.id)
          $app.save(logRecord)
        } catch (logErr) {}
        return e.json(200, { success: true })
      }

      var errDetail = 'Erro desconhecido'
      if (res.json && res.json.message) {
        errDetail = res.json.message
      }
      return e.json(500, { error: 'Falha ao enviar email', details: errDetail })
    } catch (err) {
      return e.json(500, { error: 'Candidato não encontrado' })
    }
  },
  $apis.requireAuth(),
)
