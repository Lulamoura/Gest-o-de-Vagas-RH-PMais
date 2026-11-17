// 0081 — Adiciona o campo de texto "Dados de Substituição" (dados_substituicao)
// à coleção `candidates`, a pedido do RH (Luiz). Campo simples, opcional,
// vazio por padrão — candidatos existentes permanecem inalterados.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('candidates')
    if (!col.fields.getByName('dados_substituicao')) {
      col.fields.add(new TextField({ name: 'dados_substituicao', maxSize: 2000 }))
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('candidates')
    const field = col.fields.getByName('dados_substituicao')
    if (field) {
      col.fields.removeByName('dados_substituicao')
      app.save(col)
    }
  },
)
