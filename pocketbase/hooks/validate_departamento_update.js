onRecordUpdateRequest((e) => {
  const authProfile = e.auth ? e.auth.getString('profile') : ''

  if (authProfile === 'superadmin') {
    e.next()
    return
  }

  const body = e.requestInfo().body || {}
  if ('departamento' in body) {
    const oldVal = e.record.getString('departamento')
    const newVal = body.departamento || ''
    if (oldVal !== newVal) {
      e.badRequestError('Apenas Super Admin pode alterar o departamento de usuários.')
      return
    }
  }

  e.next()
}, 'users')
