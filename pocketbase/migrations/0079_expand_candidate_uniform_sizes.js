migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('candidates')
    var uniformSize = col.fields.getByName('tamanho_fardamento')
    if (!uniformSize) {
      throw new Error('candidates.tamanho_fardamento not found')
    }

    uniformSize.values = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG']
    uniformSize.maxSelect = 1
    app.save(col)
  },
  (app) => {
    var col = app.findCollectionByNameOrId('candidates')
    var uniformSize = col.fields.getByName('tamanho_fardamento')
    if (!uniformSize) {
      throw new Error('candidates.tamanho_fardamento not found')
    }

    uniformSize.values = ['PP', 'P', 'M', 'G', 'GG']
    uniformSize.maxSelect = 1
    app.save(col)
  },
)
