migrate(
  (app) => {
    const vacCol = app.findCollectionByNameOrId('vacancies')

    if (!vacCol.fields.getByName('despesas_vaga')) {
      vacCol.fields.add(
        new NumberField({
          name: 'despesas_vaga',
          min: 0,
        }),
      )
    }

    app.save(vacCol)

    app
      .db()
      .newQuery('UPDATE vacancies SET despesas_vaga = 0 WHERE despesas_vaga IS NULL')
      .execute()
  },
  (app) => {
    const vacCol = app.findCollectionByNameOrId('vacancies')

    const despesasField = vacCol.fields.getByName('despesas_vaga')
    if (despesasField) {
      vacCol.fields.remove(despesasField)
    }

    app.save(vacCol)
  },
)
