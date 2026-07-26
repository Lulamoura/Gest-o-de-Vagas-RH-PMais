migrate(
  (app) => {
    const vacCol = app.findCollectionByNameOrId('vacancies')
    if (!vacCol.fields.getByName('wordpress_job_id')) {
      vacCol.fields.add(new TextField({ name: 'wordpress_job_id' }))
    }
    app.save(vacCol)

    const vacCol2 = app.findCollectionByNameOrId('vacancies')
    vacCol2.addIndex('idx_wordpress_job_id', true, 'wordpress_job_id', "wordpress_job_id != ''")
    app.save(vacCol2)

    const importLogs = new Collection({
      name: 'wordpress_import_logs',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: '',
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'wordpress_job_id', type: 'text', required: true },
        { name: 'origem', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['sucesso', 'duplicada', 'erro'],
          maxSelect: 1,
        },
        { name: 'mensagem', type: 'text' },
        { name: 'data_hora', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [],
    })
    app.save(importLogs)
  },
  (app) => {
    try {
      const vacCol = app.findCollectionByNameOrId('vacancies')
      vacCol.removeIndex('idx_wordpress_job_id')
      const field = vacCol.fields.getByName('wordpress_job_id')
      if (field) {
        vacCol.fields.remove(field)
      }
      app.save(vacCol)
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('wordpress_import_logs'))
    } catch (_) {}
  },
)
