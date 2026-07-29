onRecordUpdateRequest((e) => {
  const body = e.requestInfo().body || {}
  if ('observacao' in body && body.observacao !== '' && body.observacao != null) {
    const auth = e.requestInfo().auth
    const profile = auth ? auth.getString('profile') : ''
    if (profile !== 'admin' && profile !== 'superadmin') {
      throw new ForbiddenError('Apenas administradores podem editar o campo observação.')
    }
  }
  e.next()
}, 'candidates')
