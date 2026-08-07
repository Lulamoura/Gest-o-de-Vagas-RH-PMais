onRecordCreateRequest((e) => {
  var record = e.record
  var requisitionId = record.getString('requisition')
  var userId = e.auth ? e.auth.id : ''
  var userProfile = e.auth ? e.auth.getString('profile') : ''

  if (!userId) {
    return e.unauthorizedError('Autenticação necessária')
  }

  var req
  try {
    req = $app.findRecordById('requisitions', requisitionId)
  } catch (err) {
    return e.badRequestError('Requisição não encontrada')
  }

  try {
    var reqSolicitante = req.getString('solicitante')
    var isSolicitante = userId === reqSolicitante
    var isAdmin = userProfile === 'admin' || userProfile === 'superadmin'

    var departamentoId = e.auth.getString('departamento')
    var isRH = false
    if (departamentoId) {
      try {
        var dept = $app.findRecordById('departamentos', departamentoId)
        isRH = dept.getString('nome') === 'rh'
      } catch (_) {}
    }

    if (!isSolicitante && !isAdmin && !isRH) {
      return e.forbiddenError('Apenas o solicitante ou RH pode criar solicitações de alteração')
    }

    if (req.getString('status') !== 'Aprovada') {
      return e.badRequestError('Só é possível solicitar alteração em requisições aprovadas')
    }

    record.set('solicitante', userId)
    record.set('status', 'Pendente')
  } catch (err) {
    return e.badRequestError('Erro ao validar solicitação de alteração: ' + String(err))
  }

  e.next()
}, 'requisition_change_requests')
