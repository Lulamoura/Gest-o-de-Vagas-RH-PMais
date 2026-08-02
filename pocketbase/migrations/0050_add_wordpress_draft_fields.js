migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('requisitions')

    var pubFields = [
      'jornada',
      'horario',
      'escala',
      'remuneracao',
      'beneficios',
      'requisitos',
      'escolaridade',
      'experiencia',
    ]
    for (var i = 0; i < pubFields.length; i++) {
      if (!col.fields.getByName(pubFields[i])) {
        col.fields.add(new TextField({ name: pubFields[i] }))
      }
    }

    if (!col.fields.getByName('wordpress_job_id')) {
      col.fields.add(new TextField({ name: 'wordpress_job_id' }))
    }
    if (!col.fields.getByName('wordpress_admin_url')) {
      col.fields.add(new TextField({ name: 'wordpress_admin_url' }))
    }
    if (!col.fields.getByName('wordpress_sync_status')) {
      col.fields.add(
        new SelectField({
          name: 'wordpress_sync_status',
          values: ['pendente', 'sucesso', 'erro'],
          maxSelect: 1,
        }),
      )
    }
    if (!col.fields.getByName('wordpress_sync_date')) {
      col.fields.add(new DateField({ name: 'wordpress_sync_date' }))
    }
    if (!col.fields.getByName('wordpress_error_message')) {
      col.fields.add(new TextField({ name: 'wordpress_error_message' }))
    }

    col.fields.removeByName('status')
    col.fields.add(
      new SelectField({
        name: 'status',
        values: [
          'Rascunho',
          'Aguardando aprovação',
          'Em análise',
          'Aprovada',
          'Reprovada',
          'Cancelada',
          'Rascunho criado no WordPress',
        ],
        maxSelect: 1,
      }),
    )

    app.save(col)

    col.addIndex('idx_requisitions_wp_job_id', true, 'wordpress_job_id', "wordpress_job_id != ''")
    col.addIndex('idx_requisitions_wp_sync_status', false, 'wordpress_sync_status', '')
    app.save(col)
  },
  (app) => {
    var col = app.findCollectionByNameOrId('requisitions')

    var fieldsToRemove = [
      'jornada',
      'horario',
      'escala',
      'remuneracao',
      'beneficios',
      'requisitos',
      'escolaridade',
      'experiencia',
      'wordpress_job_id',
      'wordpress_admin_url',
      'wordpress_sync_status',
      'wordpress_sync_date',
      'wordpress_error_message',
    ]
    for (var i = 0; i < fieldsToRemove.length; i++) {
      var f = col.fields.getByName(fieldsToRemove[i])
      if (f) col.fields.remove(f)
    }

    col.fields.removeByName('status')
    col.fields.add(
      new SelectField({
        name: 'status',
        values: [
          'Rascunho',
          'Aguardando aprovação',
          'Em análise',
          'Aprovada',
          'Reprovada',
          'Cancelada',
        ],
        maxSelect: 1,
      }),
    )

    col.removeIndex('idx_requisitions_wp_job_id')
    col.removeIndex('idx_requisitions_wp_sync_status')
    app.save(col)
  },
)
