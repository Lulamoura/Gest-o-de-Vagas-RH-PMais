migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('requisitions')

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
          'Publicada',
        ],
        maxSelect: 1,
      }),
    )

    if (!col.fields.getByName('link_publico')) {
      col.fields.add(new TextField({ name: 'link_publico' }))
    }

    if (!col.fields.getByName('data_publicacao')) {
      col.fields.add(new DateField({ name: 'data_publicacao' }))
    }

    app.save(col)

    var reqs = []
    try {
      reqs = app.findRecordsByFilter(
        'requisitions',
        "status = 'Rascunho criado no WordPress'",
        '-created',
        0,
        0,
      )
    } catch (_) {}

    var today = new Date().toISOString().split('T')[0]

    for (var i = 0; i < reqs.length; i++) {
      var req = reqs[i]
      var wpJobId = req.getString('wordpress_job_id')
      if (!wpJobId) continue

      var vacancy = null
      try {
        vacancy = app.findFirstRecordByData('vacancies', 'wordpress_job_id', wpJobId)
      } catch (_) {}

      if (!vacancy) continue

      req.set('status', 'Publicada')
      req.set('wordpress_sync_status', 'sucesso')
      req.set('wordpress_sync_date', today)
      req.set('data_publicacao', today)

      var vacLink = vacancy.getString('link_publico')
      if (vacLink) {
        req.set('link_publico', vacLink)
      }

      try {
        app.save(req)
      } catch (_) {
        continue
      }

      try {
        var historyCol = app.findCollectionByNameOrId('requisition_history')
        var historyRecord = new Record(historyCol)
        historyRecord.set('requisition_id', req.id)
        historyRecord.set('status_anterior', 'Rascunho criado no WordPress')
        historyRecord.set('status_novo', 'Publicada')
        historyRecord.set('acao', 'wordpress')
        historyRecord.set(
          'observacao',
          'Vaga publicada no WordPress e sincronizada com o GV (backfill)',
        )
        app.save(historyRecord)
      } catch (_) {}
    }
  },
  (app) => {
    var col = app.findCollectionByNameOrId('requisitions')

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

    var linkField = col.fields.getByName('link_publico')
    if (linkField) col.fields.remove(linkField)

    var dataField = col.fields.getByName('data_publicacao')
    if (dataField) col.fields.remove(dataField)

    app.save(col)

    var pubReqs = []
    try {
      pubReqs = app.findRecordsByFilter('requisitions', "status = 'Publicada'", '-created', 0, 0)
    } catch (_) {}

    for (var i = 0; i < pubReqs.length; i++) {
      var req = pubReqs[i]
      req.set('status', 'Rascunho criado no WordPress')
      try {
        app.save(req)
      } catch (_) {}
    }
  },
)
