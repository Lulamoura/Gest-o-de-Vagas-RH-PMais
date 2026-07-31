migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('custos_consultas')

    const count = app.countRecords('custos_consultas')
    if (count > 0) return

    const record = new Record(col)
    record.set('consulta_juridica', 0)
    record.set('resumo_ia', 0)
    record.set('capa_processo', 0)
    app.save(record)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('custos_consultas')
      app.truncateCollection(col)
    } catch (_) {}
  },
)
