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
      clinica_nome: 'Clínica Santa Saúde',
      clinica_endereco: 'Rua das Flores, 123 - Centro',
      clinica_telefone: '(11) 3333-4444',
      clinica_email: 'contato@clinicasantasaude.com.br',
      clinica_contato: 'Dra. Ana Paula',
      comentario: 'Realizar exames de sangue e raios-X, comparecer em jejum.',
    }

    var sampleReplacements = {
      candidate_name: sampleData.candidate_name,
      vacancy_name: sampleData.vacancy_name,
      company_name: sampleData.company_name,
      public_url: sampleData.public_url,
      clinica_nome: sampleData.clinica_nome,
      clinica_endereco: sampleData.clinica_endereco,
      clinica_telefone: sampleData.clinica_telefone,
      clinica_email: sampleData.clinica_email,
      clinica_contato: sampleData.clinica_contato,
      comentario: sampleData.comentario,
      nome: sampleData.candidate_name,
      nome_candidato: sampleData.candidate_name,
      vaga: sampleData.vacancy_name,
      link_formulario: sampleData.public_url,
      observacao: sampleData.comentario,
    }

    var finalSubject = subject
    var finalBody = emailBody
    for (var skey in sampleReplacements) {
      var sval = sampleReplacements[skey]
      finalSubject = finalSubject
        .replace(new RegExp('\\{\\{' + skey + '\\}\\}', 'g'), sval)
        .replace(new RegExp('\\{' + skey + '\\}', 'g'), sval)
      finalBody = finalBody
        .replace(new RegExp('\\{\\{' + skey + '\\}\\}', 'g'), sval)
        .replace(new RegExp('\\{' + skey + '\\}', 'g'), sval)
    }

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
