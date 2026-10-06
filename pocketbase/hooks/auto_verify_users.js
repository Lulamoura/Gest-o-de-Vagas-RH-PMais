onRecordCreate((e) => {
  e.record.setVerified(true)
  // Se o campo 'ativo' não foi fornecido explicitamente, define padrão true
  if (e.record.get('ativo') === undefined || e.record.get('ativo') === null) {
    e.record.set('ativo', true)
  }
  e.next()
}, 'users')
