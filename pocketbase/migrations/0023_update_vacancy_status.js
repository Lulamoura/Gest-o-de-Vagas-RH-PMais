migrate(
  (app) => {
    app
      .db()
      .newQuery("UPDATE vacancies SET status_vaga = 'Concluída' WHERE status_vaga = 'Fechada'")
      .execute()

    app
      .db()
      .newQuery(
        "UPDATE vacancies SET status_vaga = 'Aberta' WHERE status_vaga IN ('Triagem', 'Entrevistas', 'Pré-Aprovação', 'Alocação')",
      )
      .execute()

    var col = app.findCollectionByNameOrId('vacancies')
    var existingField = col.fields.getByName('status_vaga')
    if (existingField) {
      col.fields.removeById(existingField.id)
    }
    col.fields.add(
      new SelectField({
        name: 'status_vaga',
        values: ['Aberta', 'Concluída', 'Cancelada'],
        maxSelect: 1,
      }),
    )
    app.save(col)
  },
  (app) => {
    app
      .db()
      .newQuery("UPDATE vacancies SET status_vaga = 'Fechada' WHERE status_vaga = 'Concluída'")
      .execute()

    var col = app.findCollectionByNameOrId('vacancies')
    var existingField = col.fields.getByName('status_vaga')
    if (existingField) {
      col.fields.removeById(existingField.id)
    }
    col.fields.add(
      new SelectField({
        name: 'status_vaga',
        values: [
          'Aberta',
          'Triagem',
          'Entrevistas',
          'Pré-Aprovação',
          'Alocação',
          'Fechada',
          'Cancelada',
        ],
        maxSelect: 1,
      }),
    )
    app.save(col)
  },
)
