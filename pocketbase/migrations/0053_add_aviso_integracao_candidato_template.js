migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('email_templates')
    var typeField = col.fields.getByName('type')
    if (typeField) {
      col.fields.remove(typeField)
    }
    col.fields.add(
      new SelectField({
        name: 'type',
        required: true,
        values: [
          'complement_data',
          'disqualification',
          'encaminhamento_exames',
          'aviso_integracao_candidato',
        ],
        maxSelect: 1,
      }),
    )
    app.save(col)

    var templatesCol = app.findCollectionByNameOrId('email_templates')
    try {
      app.findFirstRecordByData('email_templates', 'type', 'aviso_integracao_candidato')
    } catch (_) {
      var rec = new Record(templatesCol)
      rec.set('type', 'aviso_integracao_candidato')
      rec.set('subject', 'Informações sobre sua Integração - {{vaga}}')
      rec.set(
        'body',
        '<p>Olá <strong>{{nome}}</strong>,</p>' +
          '<p>Sua integração para a vaga de <strong>{{vaga}}</strong> est\u00e1 agendada.</p>' +
          '<p><strong>Data:</strong> {{data_integracao}}<br>' +
          '<strong>Hora:</strong> {{hora_integracao}}<br>' +
          '<strong>Tipo:</strong> {{tipo_integracao}}</p>' +
          '{{detalhes_integracao}}' +
          '<p>Atenciosamente,<br>Equipe RH PMais</p>',
      )
      app.save(rec)
    }
  },
  (app) => {
    try {
      var template = app.findFirstRecordByData(
        'email_templates',
        'type',
        'aviso_integracao_candidato',
      )
      app.delete(template)
    } catch (_) {}

    var col = app.findCollectionByNameOrId('email_templates')
    var typeField = col.fields.getByName('type')
    if (typeField) {
      col.fields.remove(typeField)
    }
    col.fields.add(
      new SelectField({
        name: 'type',
        required: true,
        values: ['complement_data', 'disqualification', 'encaminhamento_exames'],
        maxSelect: 1,
      }),
    )
    app.save(col)
  },
)
