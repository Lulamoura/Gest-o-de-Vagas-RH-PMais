migrate(
  (app) => {
    var templatesCol = app.findCollectionByNameOrId('email_templates')
    var oldTypeField = templatesCol.fields.getByName('type')
    if (oldTypeField) {
      templatesCol.fields.removeByName('type')
    }
    templatesCol.fields.add(
      new SelectField({
        name: 'type',
        required: true,
        values: ['complement_data', 'disqualification', 'encaminhamento_exames'],
        maxSelect: 1,
      }),
    )
    app.save(templatesCol)

    var logCol = app.findCollectionByNameOrId('candidate_email_log')
    var oldEmailTypeField = logCol.fields.getByName('email_type')
    if (oldEmailTypeField) {
      logCol.fields.removeByName('email_type')
    }
    logCol.fields.add(
      new SelectField({
        name: 'email_type',
        required: true,
        values: ['complement_data', 'disqualification', 'encaminhamento_exames'],
        maxSelect: 1,
      }),
    )
    app.save(logCol)

    try {
      app.findFirstRecordByData('email_templates', 'type', 'encaminhamento_exames')
    } catch (_) {
      var col = app.findCollectionByNameOrId('email_templates')
      var rec = new Record(col)
      rec.set('type', 'encaminhamento_exames')
      rec.set('subject', 'Encaminhamento para Exames - {vacancy_name}')
      var body =
        '<p>Olá {candidate_name},</p>' +
        '<p>Você foi aprovado(a) na etapa de análise e deve realizar os exames admissionais para a vaga de <strong>{vacancy_name}</strong>.</p>' +
        '<p>Abaixo estão as informações da clínica onde você deve realizar os exames:</p>' +
        '<p><strong>Clínica:</strong> {clinica_nome}</p>' +
        '<p><strong>Endereço:</strong> {clinica_endereco}</p>' +
        '<p><strong>Telefone:</strong> {clinica_telefone}</p>' +
        '<p><strong>E-mail:</strong> {clinica_email}</p>' +
        '<p><strong>Contato:</strong> {clinica_contato}</p>' +
        '<p><strong>Instruções:</strong></p>' +
        '<p>{comentario}</p>' +
        '<p>Atenciosamente,<br><strong>RH da {company_name}.</strong></p>'
      rec.set('body', body)
      app.save(rec)
    }
  },
  (app) => {
    var templatesCol = app.findCollectionByNameOrId('email_templates')
    var typeField = templatesCol.fields.getByName('type')
    if (typeField) {
      templatesCol.fields.removeByName('type')
    }
    templatesCol.fields.add(
      new SelectField({
        name: 'type',
        required: true,
        values: ['complement_data', 'disqualification'],
        maxSelect: 1,
      }),
    )
    app.save(templatesCol)

    var logCol = app.findCollectionByNameOrId('candidate_email_log')
    var emailTypeField = logCol.fields.getByName('email_type')
    if (emailTypeField) {
      logCol.fields.removeByName('email_type')
    }
    logCol.fields.add(
      new SelectField({
        name: 'email_type',
        required: true,
        values: ['complement_data', 'disqualification'],
        maxSelect: 1,
      }),
    )
    app.save(logCol)

    try {
      var rec = app.findFirstRecordByData('email_templates', 'type', 'encaminhamento_exames')
      app.delete(rec)
    } catch (_) {}
  },
)
