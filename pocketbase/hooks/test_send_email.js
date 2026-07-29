routerAdd(
  'POST',
  '/backend/v1/test-send-email',
  (e) => {
    const body = e.requestInfo().body || {}
    const subject = body.subject || ''
    const emailBody = body.body || ''
    var testEmail = body.test_email || ''
    if (!testEmail && e.auth) {
      testEmail = e.auth.getString('email')
    }
    if (!testEmail) return e.badRequestError('Email destinatário não informado')
    if (!subject || !emailBody) return e.badRequestError('Assunto e corpo são obrigatórios')

    var sampleData = {
      candidate_name: 'Maria Silva',
      vacancy_name: 'Auxiliar de Limpeza',
      company_name: 'PMais Terceirização',
      public_url: 'https://vagaspmais.pmaisservicos.com.br/candidato/example/preencher',
    }

    var finalSubject = subject
      .replace(/\{candidate_name\}/g, sampleData.candidate_name)
      .replace(/\{vacancy_name\}/g, sampleData.vacancy_name)
      .replace(/\{company_name\}/g, sampleData.company_name)
      .replace(/\{public_url\}/g, sampleData.public_url)

    var finalBody = emailBody
      .replace(/\{candidate_name\}/g, sampleData.candidate_name)
      .replace(/\{vacancy_name\}/g, sampleData.vacancy_name)
      .replace(/\{company_name\}/g, sampleData.company_name)
      .replace(/\{public_url\}/g, sampleData.public_url)

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
        to: testEmail,
        subject: '[TESTE] ' + finalSubject,
        html: finalBody,
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
    return e.json(500, { error: 'Falha ao enviar email de teste', details: errDetail })
  },
  $apis.requireAuth(),
)
