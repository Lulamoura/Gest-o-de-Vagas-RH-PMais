routerAdd(
  'POST',
  '/backend/v1/send-encaminhamento-exames',
  (e) => {
    var body = e.requestInfo().body || {}
    var candidateId = body.candidate_id || ''
    var clinicaId = body.clinica_id || ''
    var comentario = body.comentario || ''
    var custoExames = Number(body.custo_exames) || 0

    if (!candidateId) return e.badRequestError('candidate_id é obrigatório')
    if (!clinicaId) return e.badRequestError('clinica_id é obrigatório')
    if (!comentario.trim()) return e.badRequestError('comentário é obrigatório')
    if (custoExames <= 0) return e.badRequestError('custo_exames deve ser maior que zero')

    try {
      var candidate = $app.findRecordById('candidates', candidateId)
      var candidateEmail = candidate.getString('email')
      if (!candidateEmail) return e.badRequestError('Candidato não possui email cadastrado')

      var candidateStatus = candidate.getString('status_candidato')
      if (candidateStatus !== 'Documentação e exame') {
        return e.badRequestError('Candidato não está no status Documentação e exame')
      }

      var clinica = $app.findRecordById('clinicas', clinicaId)
      var clinicaNome = clinica.getString('nome')
      var clinicaEndereco = clinica.getString('endereco')
      var clinicaTelefone = clinica.getString('telefone')
      var clinicaEmail = clinica.getString('email')
      var clinicaContato = clinica.getString('pessoa_contato')

      var vacancyId = candidate.getString('vacancy_id')
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

      var clinicaInfoHtml = ''
      if (clinicaNome) clinicaInfoHtml += '<p><strong>Clínica:</strong> ' + clinicaNome + '</p>'
      if (clinicaEndereco)
        clinicaInfoHtml += '<p><strong>Endereço:</strong> ' + clinicaEndereco + '</p>'
      if (clinicaTelefone)
        clinicaInfoHtml += '<p><strong>Telefone:</strong> ' + clinicaTelefone + '</p>'
      if (clinicaEmail) clinicaInfoHtml += '<p><strong>E-mail:</strong> ' + clinicaEmail + '</p>'
      if (clinicaContato)
        clinicaInfoHtml += '<p><strong>Contato:</strong> ' + clinicaContato + '</p>'

      var defaultSubject = 'Encaminhamento para Exames - ' + vacancyTitle
      var defaultBody =
        '<p>Olá ' +
        candidateName +
        ',</p>' +
        '<p>Você foi aprovado(a) na etapa de análise e deve realizar os exames admissionais para a vaga de <strong>' +
        vacancyTitle +
        '</strong>.</p>' +
        '<p>Abaixo estão as informações da clínica onde você deve realizar os exames:</p>' +
        clinicaInfoHtml +
        '<p><strong>Instruções:</strong></p>' +
        '<p>' +
        comentario +
        '</p>' +
        '<p>Atenciosamente,<br><strong>RH da ' +
        companyName +
        '.</strong></p>'

      var emailSubject = defaultSubject
      var emailBody = defaultBody

      try {
        var template = $app.findFirstRecordByData(
          'email_templates',
          'type',
          'encaminhamento_exames',
        )
        if (template) {
          var tplSubject = template.getString('subject')
          var tplBody = template.getString('body')
          if (tplSubject && tplBody) {
            emailSubject = tplSubject
              .replace(/\{candidate_name\}/g, candidateName)
              .replace(/\{vacancy_name\}/g, vacancyTitle)
              .replace(/\{company_name\}/g, companyName)
              .replace(/\{clinica_nome\}/g, clinicaNome)
              .replace(/\{clinica_endereco\}/g, clinicaEndereco)
              .replace(/\{clinica_telefone\}/g, clinicaTelefone)
              .replace(/\{clinica_email\}/g, clinicaEmail)
              .replace(/\{clinica_contato\}/g, clinicaContato)
              .replace(/\{comentario\}/g, comentario)
            emailBody = tplBody
              .replace(/\{candidate_name\}/g, candidateName)
              .replace(/\{vacancy_name\}/g, vacancyTitle)
              .replace(/\{company_name\}/g, companyName)
              .replace(/\{clinica_nome\}/g, clinicaNome)
              .replace(/\{clinica_endereco\}/g, clinicaEndereco)
              .replace(/\{clinica_telefone\}/g, clinicaTelefone)
              .replace(/\{clinica_email\}/g, clinicaEmail)
              .replace(/\{clinica_contato\}/g, clinicaContato)
              .replace(/\{comentario\}/g, comentario)
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
        var currentCost = candidate.getNumber('custo_exames') || 0
        candidate.set('custo_exames', currentCost + custoExames)
        $app.save(candidate)

        try {
          var logCol = $app.findCollectionByNameOrId('candidate_email_log')
          var logRecord = new Record(logCol)
          logRecord.set('candidate_id', candidateId)
          logRecord.set('email_type', 'encaminhamento_exames')
          logRecord.set('sent_by', e.auth.id)
          $app.save(logRecord)
        } catch (logErr) {}
        return e.json(200, { success: true })
      }

      var errDetail = 'Erro desconhecido'
      if (res.json && res.json.message) {
        errDetail = res.json.message
      }
      try {
        var failLogCol = $app.findCollectionByNameOrId('candidate_email_log')
        var failLogRecord = new Record(failLogCol)
        failLogRecord.set('candidate_id', candidateId)
        failLogRecord.set('email_type', 'encaminhamento_exames')
        failLogRecord.set('sent_by', e.auth.id)
        failLogRecord.set('error_message', errDetail)
        $app.save(failLogRecord)
      } catch (logErr2) {}
      return e.json(500, { error: 'Falha ao enviar email', details: errDetail })
    } catch (err) {
      return e.json(500, { error: 'Erro ao processar solicitação' })
    }
  },
  $apis.requireAuth(),
)
