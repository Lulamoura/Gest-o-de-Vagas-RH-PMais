migrate(
  (app) => {
    const collection = new Collection({
      name: 'email_templates',
      type: 'base',
      listRule: "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'",
      viewRule: "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'",
      createRule: "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'",
      updateRule: "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'",
      deleteRule: "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'",
      fields: [
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['complement_data', 'disqualification'],
          maxSelect: 1,
        },
        {
          name: 'subject',
          type: 'text',
          required: true,
        },
        {
          name: 'body',
          type: 'text',
          required: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_email_templates_type ON email_templates (type)'],
    })
    app.save(collection)

    var templatesCol = app.findCollectionByNameOrId('email_templates')

    var complementDataBody =
      '<p>Olá {candidate_name},</p>' +
      '<p>Parabéns por avan\u00e7ar no processo seletivo para a vaga de <strong>{vacancy_name}</strong>!</p>' +
      '<p>Para darmos continuidade \u00e0 pr\u00f3xima etapa, precisamos que voc\u00ea preencha algumas informa\u00e7\u00f5es complementares (dados de uniformidade, contato de emerg\u00eancia, etc.).</p>' +
      '<p>Por favor, acesse o link abaixo e preencha o formul\u00e1rio:</p>' +
      '<p><a href="{public_url}">{public_url}</a></p>' +
      '<p>O prazo para preenchimento \u00e9 de 48 horas.</p>' +
      '<p>Atenciosamente,<br><strong>RH da {company_name}.</strong></p>'

    var disqualificationBody =
      '<p>Olá {candidate_name},</p>' +
      '<p>Agradecemos sua participa\u00e7\u00e3o no processo seletivo para a vaga de <strong>{vacancy_name}</strong> na {company_name}.</p>' +
      '<p>Informamos que, desta vez, voc\u00ea n\u00e3o foi classificado(a) para a vaga em quest\u00e3o.</p>' +
      '<p>No entanto, seus dados permanecer\u00e3o em nosso banco de talentos e poder\u00e3o ser considerados para futuras oportunidades que sejam compat\u00edveis com seu perfil profissional.</p>' +
      '<p>Agradecemos seu interesse e desejamos sucesso em sua trajet\u00f3ria.</p>' +
      '<p>Atenciosamente,<br><strong>RH da {company_name}.</strong></p>'

    try {
      app.findFirstRecordByData('email_templates', 'type', 'complement_data')
    } catch (_) {
      var rec1 = new Record(templatesCol)
      rec1.set('type', 'complement_data')
      rec1.set('subject', 'Pr\u00f3xima etapa do processo seletivo - {vacancy_name}')
      rec1.set('body', complementDataBody)
      app.save(rec1)
    }

    try {
      app.findFirstRecordByData('email_templates', 'type', 'disqualification')
    } catch (_) {
      var rec2 = new Record(templatesCol)
      rec2.set('type', 'disqualification')
      rec2.set('subject', 'Aviso de Desclassica\u00e7\u00e3o \u2013 {vacancy_name}')
      rec2.set('body', disqualificationBody)
      app.save(rec2)
    }
  },
  (app) => {
    var collection = app.findCollectionByNameOrId('email_templates')
    app.delete(collection)
  },
)
