migrate(
  (app) => {
    var spCol = app.findCollectionByNameOrId('system_parameters')

    if (!spCol.fields.getByName('email_dp_lista')) {
      spCol.fields.add(new TextField({ name: 'email_dp_lista' }))
    }
    if (!spCol.fields.getByName('email_operacional_lista')) {
      spCol.fields.add(new TextField({ name: 'email_operacional_lista' }))
    }
    if (!spCol.fields.getByName('email_comercial')) {
      spCol.fields.add(new TextField({ name: 'email_comercial' }))
    }
    app.save(spCol)

    app
      .db()
      .newQuery(
        'UPDATE system_parameters SET email_dp_lista = email_dp WHERE email_dp != "" AND (email_dp_lista IS NULL OR email_dp_lista = "")',
      )
      .execute()
    app
      .db()
      .newQuery(
        'UPDATE system_parameters SET email_operacional_lista = email_operacional WHERE email_operacional != "" AND (email_operacional_lista IS NULL OR email_operacional_lista = "")',
      )
      .execute()

    var deptCol = app.findCollectionByNameOrId('departamentos')
    try {
      app.findFirstRecordByData('departamentos', 'nome', 'DP')
    } catch (_) {
      var rec = new Record(deptCol)
      rec.set('nome', 'DP')
      app.save(rec)
    }
  },
  (app) => {
    try {
      var spCol = app.findCollectionByNameOrId('system_parameters')
      spCol.fields.removeByName('email_dp_lista')
      spCol.fields.removeByName('email_operacional_lista')
      spCol.fields.removeByName('email_comercial')
      app.save(spCol)
    } catch (_) {}
  },
)
