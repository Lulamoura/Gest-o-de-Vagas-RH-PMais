migrate(
  (app) => {
    var findOrCreateRef = function (colName, nome) {
      if (!nome) return null
      try {
        return app.findFirstRecordByData(colName, 'nome', nome)
      } catch (_) {
        var col = app.findCollectionByNameOrId(colName)
        var rec = new Record(col)
        rec.set('nome', nome)
        app.save(rec)
        return rec
      }
    }

    var tiposVagaValues = ['Nova', 'Pedido de Demissão', 'Troca', 'Renovação', 'Migração']
    for (var i = 0; i < tiposVagaValues.length; i++) {
      findOrCreateRef('tipos_vaga', tiposVagaValues[i])
    }

    var oldTipos = ['Efetivo', 'Temporário', 'Estágio', 'Terceirizado', 'PJ']
    for (var j = 0; j < oldTipos.length; j++) {
      findOrCreateRef('tipos_vaga', oldTipos[j])
    }

    var commonClientes = [
      'Petrobras',
      'Vale S.A.',
      'Suzano Paper',
      'Ambev',
      'Gerdau',
      'PMais Serviços',
    ]
    for (var k = 0; k < commonClientes.length; k++) {
      findOrCreateRef('clientes', commonClientes[k])
    }

    var commonCargos = [
      'Engenheiro de Processos Sênior',
      'Analista de Manutenção Preditiva',
      'Técnico em Logística de Transporte',
      'Coordenador de Qualidade e Meio Ambiente',
      'Especialista em Automação Industrial',
      'Analista de RH',
    ]
    for (var l = 0; l < commonCargos.length; l++) {
      findOrCreateRef('cargos', commonCargos[l])
    }

    var commonCidades = [
      'Rio de Janeiro - RJ',
      'Belo Horizonte - MG',
      'Suzano - SP',
      'Jaguariúna - SP',
      'Ouro Branco - MG',
      'São Paulo',
    ]
    for (var m = 0; m < commonCidades.length; m++) {
      findOrCreateRef('cidades', commonCidades[m])
    }

    var allVacancies = app.findRecordsByFilter('vacancies', "id != ''", '', 0, 0)

    for (var v = 0; v < allVacancies.length; v++) {
      var vac = allVacancies[v]
      var oldCliente = vac.getString('old_cliente')
      var oldCargo = vac.getString('old_cargo')
      var oldCidade = vac.getString('old_cidade')
      var oldTipoVaga = vac.getString('old_tipo_vaga')

      if (oldCliente) {
        var clienteRec = findOrCreateRef('clientes', oldCliente)
        if (clienteRec) vac.set('cliente', clienteRec.id)
      }
      if (oldCargo) {
        var cargoRec = findOrCreateRef('cargos', oldCargo)
        if (cargoRec) vac.set('cargo', cargoRec.id)
      }
      if (oldCidade) {
        var cidadeRec = findOrCreateRef('cidades', oldCidade)
        if (cidadeRec) vac.set('cidade', cidadeRec.id)
      }
      if (oldTipoVaga) {
        var tipoVagaRec = findOrCreateRef('tipos_vaga', oldTipoVaga)
        if (tipoVagaRec) vac.set('tipo_vaga', tipoVagaRec.id)
      }

      app.save(vac)
    }

    var vacCol = app.findCollectionByNameOrId('vacancies')
    if (vacCol.fields.getByName('old_cliente')) {
      vacCol.fields.removeByName('old_cliente')
    }
    if (vacCol.fields.getByName('old_cargo')) {
      vacCol.fields.removeByName('old_cargo')
    }
    if (vacCol.fields.getByName('old_cidade')) {
      vacCol.fields.removeByName('old_cidade')
    }
    if (vacCol.fields.getByName('old_tipo_vaga')) {
      vacCol.fields.removeByName('old_tipo_vaga')
    }
    app.save(vacCol)
  },
  (app) => {},
)
