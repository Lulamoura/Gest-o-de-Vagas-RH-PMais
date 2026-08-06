onRecordUpdateRequest((e) => {
  var body = e.requestInfo().body || {}

  if ('edicao_liberada' in body) {
    var userProfile = e.auth ? e.auth.getString('profile') : ''
    var isAdmin = userProfile === 'admin' || userProfile === 'superadmin'
    var newVal = body.edicao_liberada
    var isTrue = newVal === true || newVal === 'true' || newVal === 1 || newVal === '1'
    var currentVal = e.record.getBool('edicao_liberada')

    // Block non-admins from setting to true (unless it's already true)
    if (!isAdmin && isTrue && !currentVal) {
      return e.badRequestError(
        'Você não pode liberar a edição por conta própria. A liberação deve ser aprovada pelo RH.',
      )
    }
  }

  e.next()
}, 'requisitions')
