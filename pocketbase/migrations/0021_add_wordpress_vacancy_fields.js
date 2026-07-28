migrate(
  (app) => {
    const vacCol = app.findCollectionByNameOrId('vacancies')

    if (!vacCol.fields.getByName('link_publico')) {
      vacCol.fields.add(new TextField({ name: 'link_publico' }))
    }
    if (!vacCol.fields.getByName('perfil_interno')) {
      vacCol.fields.add(new TextField({ name: 'perfil_interno' }))
    }
    if (!vacCol.fields.getByName('origem')) {
      vacCol.fields.add(new TextField({ name: 'origem' }))
    }

    app.save(vacCol)
  },
  (app) => {
    const vacCol = app.findCollectionByNameOrId('vacancies')

    const linkPublico = vacCol.fields.getByName('link_publico')
    if (linkPublico) {
      vacCol.fields.remove(linkPublico)
    }
    const perfilInterno = vacCol.fields.getByName('perfil_interno')
    if (perfilInterno) {
      vacCol.fields.remove(perfilInterno)
    }
    const origem = vacCol.fields.getByName('origem')
    if (origem) {
      vacCol.fields.remove(origem)
    }

    app.save(vacCol)
  },
)
