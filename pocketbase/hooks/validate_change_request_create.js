onRecordCreateRequest((e) => {
  var record = e.record
  var requisitionId = record.getString('requisition')
  var userId = e.auth ? e.auth.id : ''
  var userProfile = e.auth ? e.auth.getString('profile') : ''

  if (!userId) {
    return e.unauthorizedError('Autenticação necessária')
  }

  var req = $app.findRecordById('requisitions', requisitionId)
  var reqSolicitante = req.getString('solicitante')
  var isSolicitante = userId === reqSolicitante
  var isAdmin = userProfile === 'admin' || userProfile === 'superadmin'

  if (!isSolicitante && !isAdmin) {
    return e.forbiddenError('Apenas o solicitante ou RH pode criar solicitações de alteração')
  }

  if (req.getString('status') !== 'Aprovada') {
    return e.badRequestError('Só é possível solicitar alteração em requisições aprovadas')
  }

  record.set('solicitante', userId)
  record.set('status', 'Pendente')

  e.next()
}, 'requisition_change_requests')
