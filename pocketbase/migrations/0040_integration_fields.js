migrate(
  (app) => {
    var candidatesCol = app.findCollectionByNameOrId('candidates')
    if (!candidatesCol.fields.getByName('integracao_ativa')) {
      candidatesCol.fields.add(new BoolField({ name: 'integracao_ativa' }))
    }
    if (!candidatesCol.fields.getByName('data_integracao')) {
      candidatesCol.fields.add(new DateField({ name: 'data_integracao' }))
    }
    candidatesCol.addIndex('idx_candidates_integracao_ativa', false, 'integracao_ativa', '')
    candidatesCol.addIndex('idx_candidates_data_integracao', false, 'data_integracao', '')
    app.save(candidatesCol)

    var spCol = app.findCollectionByNameOrId('system_parameters')
    if (!spCol.fields.getByName('email_dp')) {
      spCol.fields.add(new EmailField({ name: 'email_dp' }))
    }
    if (!spCol.fields.getByName('email_operacional')) {
      spCol.fields.add(new EmailField({ name: 'email_operacional' }))
    }
    app.save(spCol)

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
        ],
        maxSelect: 1,
      }),
    )
    app.save(logCol)
  },
  (app) => {
    var candidatesCol = app.findCollectionByNameOrId('candidates')
    candidatesCol.removeIndex('idx_candidates_integracao_ativa')
    candidatesCol.removeIndex('idx_candidates_data_integracao')
    var iaField = candidatesCol.fields.getByName('integracao_ativa')
    if (iaField) candidatesCol.fields.remove(iaField)
    var diField = candidatesCol.fields.getByName('data_integracao')
    if (diField) candidatesCol.fields.remove(diField)
    app.save(candidatesCol)

    var spCol = app.findCollectionByNameOrId('system_parameters')
    var edpField = spCol.fields.getByName('email_dp')
    if (edpField) spCol.fields.remove(edpField)
    var eoField = spCol.fields.getByName('email_operacional')
    if (eoField) spCol.fields.remove(eoField)
    app.save(spCol)

    var logCol = app.findCollectionByNameOrId('candidate_email_log')
    var etField = logCol.fields.getByName('email_type')
    if (etField) logCol.fields.removeByName('email_type')
    logCol.fields.add(
      new SelectField({
        name: 'email_type',
        required: true,
        values: ['complement_data', 'disqualification', 'encaminhamento_exames'],
        maxSelect: 1,
      }),
    )
    app.save(logCol)
  },
)
