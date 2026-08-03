migrate(
  (app) => {
    var candidatesCol = app.findCollectionByNameOrId('candidates')

    if (!candidatesCol.fields.getByName('hora_integracao')) {
      candidatesCol.fields.add(new TextField({ name: 'hora_integracao' }))
    }
    if (!candidatesCol.fields.getByName('tipo_integracao')) {
      candidatesCol.fields.add(
        new SelectField({
          name: 'tipo_integracao',
          values: ['Presencial', 'On-line'],
          maxSelect: 1,
        }),
      )
    }
    if (!candidatesCol.fields.getByName('valor_unitario_transporte')) {
      candidatesCol.fields.add(new NumberField({ name: 'valor_unitario_transporte' }))
    }
    if (!candidatesCol.fields.getByName('data_nascimento')) {
      candidatesCol.fields.add(new DateField({ name: 'data_nascimento' }))
    }
    app.save(candidatesCol)

    var logCol = app.findCollectionByNameOrId('candidate_email_log')
    var oldEmailTypeField = logCol.fields.getByName('email_type')
    if (oldEmailTypeField) {
      logCol.fields.removeByName('email_type')
    }
    logCol.fields.add(
      new SelectField({
        name: 'email_type',
        required: true,
        values: [
          'complement_data',
          'disqualification',
          'encaminhamento_exames',
          'aviso_integracao',
          'aviso_integracao_candidato',
        ],
        maxSelect: 1,
      }),
    )
    app.save(logCol)

    var baseIntegracao = new Collection({
      name: 'base_integracao',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'",
      updateRule: "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'",
      deleteRule: "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'endereco', type: 'text', required: false },
        { name: 'telefone', type: 'text', required: false },
        { name: 'email', type: 'text', required: false },
        { name: 'pessoa_contato', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(baseIntegracao)

    var col = app.findCollectionByNameOrId('base_integracao')
    var samples = [
      {
        nome: 'Base de Integração - Matriz',
        endereco: 'Av. Paulista, 2000 - São Paulo/SP',
        telefone: '(11) 3000-1000',
        email: 'integracao@pmaisservicos.com.br',
        pessoa_contato: 'Carlos Pereira',
      },
      {
        nome: 'Base de Integração - Filial Norte',
        endereco: 'Rua das Acácias, 500 - Zona Norte',
        telefone: '(11) 4000-2000',
        email: 'norte@pmaisservicos.com.br',
        pessoa_contato: 'Ana Souza',
      },
    ]
    for (var i = 0; i < samples.length; i++) {
      var s = samples[i]
      try {
        app.findFirstRecordByData('base_integracao', 'nome', s.nome)
      } catch (_) {
        var rec = new Record(col)
        rec.set('nome', s.nome)
        rec.set('endereco', s.endereco)
        rec.set('telefone', s.telefone)
        rec.set('email', s.email)
        rec.set('pessoa_contato', s.pessoa_contato)
        app.save(rec)
      }
    }
  },
  (app) => {
    try {
      var candidatesCol = app.findCollectionByNameOrId('candidates')
      var hi = candidatesCol.fields.getByName('hora_integracao')
      if (hi) candidatesCol.fields.remove(hi)
      var ti = candidatesCol.fields.getByName('tipo_integracao')
      if (ti) candidatesCol.fields.remove(ti)
      var vut = candidatesCol.fields.getByName('valor_unitario_transporte')
      if (vut) candidatesCol.fields.remove(vut)
      var dn = candidatesCol.fields.getByName('data_nascimento')
      if (dn) candidatesCol.fields.remove(dn)
      app.save(candidatesCol)
    } catch (_) {}

    try {
      var logCol = app.findCollectionByNameOrId('candidate_email_log')
      var et = logCol.fields.getByName('email_type')
      if (et) logCol.fields.removeByName('email_type')
      logCol.fields.add(
        new SelectField({
          name: 'email_type',
          required: true,
          values: [
            'complement_data',
            'disqualification',
            'encaminhamento_exames',
            'aviso_integracao',
          ],
          maxSelect: 1,
        }),
      )
      app.save(logCol)
    } catch (_) {}

    try {
      var col = app.findCollectionByNameOrId('base_integracao')
      app.delete(col)
    } catch (_) {}
  },
)
