migrate(
  (app) => {
    const candidatesCol = app.findCollectionByNameOrId('candidates')

    if (!candidatesCol.fields.getByName('cidade')) {
      candidatesCol.fields.add(
        new TextField({
          name: 'cidade',
        }),
      )
    }

    if (!candidatesCol.fields.getByName('bairro')) {
      candidatesCol.fields.add(
        new TextField({
          name: 'bairro',
        }),
      )
    }

    app.save(candidatesCol)
  },
  (app) => {
    const candidatesCol = app.findCollectionByNameOrId('candidates')

    const cidadeField = candidatesCol.fields.getByName('cidade')
    if (cidadeField) {
      candidatesCol.fields.remove(cidadeField)
    }

    const bairroField = candidatesCol.fields.getByName('bairro')
    if (bairroField) {
      candidatesCol.fields.remove(bairroField)
    }

    app.save(candidatesCol)
  },
)
