routerAdd(
  'POST',
  '/backend/v1/send-complement-data-request',
  (e) => {
    const body = e.requestInfo().body || {}
    const candidateId = body.candidate_id || ''
    if (!candidateId) return e.badRequestError('candidate_id é obrigatório')

    try {
      const candidate = $app.findRecordById('candidates', candidateId)
      const candidateEmail = candidate.getString('email')
      if (!candidateEmail) return e.badRequestError('Candidato não possui email cadastrado')

      const vacancyId = candidate.getString('vacancy_id')
      let vacancyTitle = 'Vaga'
      if (vacancyId) {
        try {
          const vacancy = $app.findRecordById('vacancies', vacancyId)
          const cargoId = vacancy.getString('cargo')
          if (cargoId) {
            try {
              const cargo = $app.findRecordById('cargos', cargoId)
              vacancyTitle = cargo.getString('nome')
            } catch (_) {}
          }
        } catch (_) {}
      }

      const candidateName = candidate.getString('nome')
      const publicUrl =
        'https://vagaspmais.pmaisservicos.com.br/candidato/' + candidateId + '/preencher'
      const subject = 'Próxima etapa do processo seletivo - ' + vacancyTitle

      const htmlBody =
        '<p>Olá ' +
        candidateName +
        ',</p>' +
        '<p>Parabéns por avançar no processo seletivo para a vaga de <strong>' +
        vacancyTitle +
        '</strong>!</p>' +
        '<p>Para darmos continuidade à próxima etapa, precisamos que você preencha algumas informações complementares (dados de uniformidade, contato de emergência, etc.).</p>' +
        '<p>Por favor, acesse o link abaixo e preencha o formulário:</p>' +
        '<p><a href="' +
        publicUrl +
        '">' +
        publicUrl +
        '</a></p>' +
        '<p>O prazo para preenchimento é de 48 horas.</p>' +
        '<p>Atenciosamente,<br><strong>RH da PMais Terceirização.</strong></p>'

      const apiKey = $secrets.get('RESEND_API_KEY')
      if (!apiKey) return e.json(500, { error: 'RESEND_API_KEY não configurado' })

      const res = $http.send({
        url: 'https://api.resend.com/emails',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apiKey,
        },
        body: JSON.stringify({
          from: 'curriculos@pmaisservicos.com.br',
          to: candidateEmail,
          subject: subject,
          html: htmlBody,
        }),
        timeout: 30,
      })

      if (res.statusCode >= 200 && res.statusCode < 300) {
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
