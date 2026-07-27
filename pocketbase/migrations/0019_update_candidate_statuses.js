migrate(
  (app) => {
    var mappings = [
      ['Em análise do gestor', 'Análise do gestor'],
      ['Pré-Aprovado', 'Documentação e exame'],
      ['Integrado', 'Integrado'],
      ['Desistiu', 'Desistente'],
      ['Não aprovado', 'Desclassificado'],
      ['Rejeitado', 'Desclassificado'],
    ]

    for (var i = 0; i < mappings.length; i++) {
      app
        .db()
        .newQuery(
          'UPDATE candidates SET status_candidato = {:newVal} WHERE status_candidato = {:oldVal}',
        )
        .bind({ newVal: mappings[i][1], oldVal: mappings[i][0] })
        .execute()
    }

    app
      .db()
      .newQuery(
        "UPDATE candidates SET status_candidato = 'Análise do RH' WHERE status_candidato IS NULL OR status_candidato = '' OR status_candidato NOT IN ('Análise do RH', 'Análise do gestor', 'Documentação e exame', 'Cadastro DP', 'Integrado', 'Desistente', 'Desclassificado', 'Em banco')",
      )
      .execute()

    var col = app.findCollectionByNameOrId('candidates')
    var existingField = col.fields.getByName('status_candidato')
    if (existingField) {
      col.fields.removeById(existingField.id)
    }
    col.fields.add(
      new SelectField({
        name: 'status_candidato',
        values: [
          'Análise do RH',
          'Análise do gestor',
          'Documentação e exame',
          'Cadastro DP',
          'Integrado',
          'Desistente',
          'Desclassificado',
          'Em banco',
        ],
        maxSelect: 1,
      }),
    )
    app.save(col)
  },
  (app) => {
    var reverseMappings = [
      ['Análise do gestor', 'Em análise do gestor'],
      ['Documentação e exame', 'Pré-Aprovado'],
      ['Integrado', 'Integrado'],
      ['Desistente', 'Desistiu'],
      ['Desclassificado', 'Rejeitado'],
      ['Análise do RH', 'Em análise do gestor'],
    ]

    for (var i = 0; i < reverseMappings.length; i++) {
      app
        .db()
        .newQuery(
          'UPDATE candidates SET status_candidato = {:newVal} WHERE status_candidato = {:oldVal}',
        )
        .bind({ newVal: reverseMappings[i][1], oldVal: reverseMappings[i][0] })
        .execute()
    }

    var col = app.findCollectionByNameOrId('candidates')
    var existingField = col.fields.getByName('status_candidato')
    if (existingField) {
      col.fields.removeById(existingField.id)
    }
    col.fields.add(
      new SelectField({
        name: 'status_candidato',
        values: [
          'Em análise do gestor',
          'Pré-Aprovado',
          'Integrado',
          'Desistiu',
          'Não aprovado',
          'Rejeitado',
        ],
        maxSelect: 1,
      }),
    )
    app.save(col)
  },
)
