migrate(
  (app) => {
    const clinicas = new Collection({
      name: 'clinicas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'",
      updateRule: "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'",
      deleteRule: "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'endereco', type: 'text', required: false },
        { name: 'telefone', type: 'text', required: false },
        { name: 'email', type: 'text', required: false },
        { name: 'pessoa_contato', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(clinicas)

    var col = app.findCollectionByNameOrId('clinicas')
    var samples = [
      {
        nome: 'Clínica São Lucas',
        endereco: 'Av. Paulista, 1500 - São Paulo/SP',
        telefone: '(11) 3456-7890',
        email: 'contato@clinicasaolucas.com.br',
        pessoa_contato: 'Dra. Fernanda Alves',
      },
      {
        nome: 'Clínica Saúde Total',
        endereco: 'Rua das Laranjeiras, 220 - Rio de Janeiro/RJ',
        telefone: '(21) 2233-4455',
        email: 'atendimento@saudetotal.com.br',
        pessoa_contato: 'Sr. Ricardo Mendes',
      },
      {
        nome: 'Clínica Vida Plena',
        endereco: 'Rua dos Andradas, 875 - Porto Alegre/RS',
        telefone: '(51) 3344-5566',
        email: 'sac@vidaplena.com.br',
        pessoa_contato: 'Sra. Juliana Castro',
      },
    ]
    for (var i = 0; i < samples.length; i++) {
      var s = samples[i]
      try {
        app.findFirstRecordByData('clinicas', 'nome', s.nome)
      } catch (_) {
        var rec = new Record(col)
        rec.set('nome', s.nome)
        rec.set('endereco', s.endereco)
        rec.set('telefone', s.telefone)
        rec.set('email', s.email)
        rec.set('pessoa_contato', s.pessoa_contato)
        app.save(rec)
      }
    }
  },
  (app) => {
    try {
      var col = app.findCollectionByNameOrId('clinicas')
      app.delete(col)
    } catch (_) {}
  },
)
