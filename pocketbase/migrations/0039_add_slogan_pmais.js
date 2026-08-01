migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('system_parameters')
    if (!col.fields.getByName('slogan_pmais')) {
      col.fields.add(new TextField({ name: 'slogan_pmais' }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('system_parameters')
    const field = col.fields.getByName('slogan_pmais')
    if (field) {
      col.fields.remove(field)
    }
    app.save(col)
  },
)
