onRecordUpdateRequest((e) => {
  try {
    var body = e.requestInfo().body || {}

    if ('edicao_liberada' in body) {
      var userProfile = e.auth ? e.auth.getString('profile') : ''
      var isAdmin = userProfile === 'admin' || userProfile === 'superadmin'
      var newVal = body.edicao_liberada
      var isTrue = newVal === true || newVal === 'true' || newVal === 1 || newVal === '1'
      var currentVal = e.record.getBool('edicao_liberada')

      if (!isAdmin && isTrue && !currentVal) {
        return e.badRequestError(
          'Você não pode liberar a edição por conta própria. A liberação deve ser aprovada pelo RH.',
        )
      }
    }

    if (body.status === 'Aguardando aprovação' && e.record.getBool('edicao_liberada')) {
      e.record.set('edicao_liberada', false)
    }
  } catch (err) {
    $app.logger().error('validate_requisition_update: error', 'error', String(err))
  }

  e.next()
}, 'requisitions')
