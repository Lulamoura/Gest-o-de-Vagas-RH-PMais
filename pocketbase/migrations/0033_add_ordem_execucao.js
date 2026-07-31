migrate(
  (app) => {
    const vacCol = app.findCollectionByNameOrId('vacancies')
    if (!vacCol.fields.getByName('ordem_execucao')) {
      vacCol.fields.add(new TextField({ name: 'ordem_execucao' }))
    }
    app.save(vacCol)

    const candCol = app.findCollectionByNameOrId('candidates')
    if (!candCol.fields.getByName('ordem_execucao')) {
      candCol.fields.add(new TextField({ name: 'ordem_execucao' }))
    }
    app.save(candCol)
  },
  (app) => {
    const vacCol = app.findCollectionByNameOrId('vacancies')
    const vacField = vacCol.fields.getByName('ordem_execucao')
    if (vacField) {
      vacCol.fields.remove(vacField)
      app.save(vacCol)
    }

    const candCol = app.findCollectionByNameOrId('candidates')
    const candField = candCol.fields.getByName('ordem_execucao')
    if (candField) {
      candCol.fields.remove(candField)
      app.save(candCol)
    }
  },
)
