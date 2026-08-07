onRecordAfterCreateSuccess((e) => {
  var cr = e.record
  var requisitionId = cr.getString('requisition')
  var solicitanteId = cr.getString('solicitante')

  try {
    var historyCol = $app.findCollectionByNameOrId('requisition_history')
    var historyRecord = new Record(historyCol)
    historyRecord.set('requisition_id', requisitionId)
    historyRecord.set('usuario_id', solicitanteId)
    historyRecord.set('status_novo', 'Aprovada')
    historyRecord.set('acao', 'solicitacao_alteracao')
    historyRecord.set('observacao', cr.getString('campos_alterados'))
    $app.save(historyRecord)
  } catch (histErr) {
    $app.logger().error('change_request_create_notify: history failed', 'error', String(histErr))
  }

  try {
    var rhUsers = $app.findRecordsByFilter(
      'users',
      "profile = 'admin' || profile = 'superadmin'",
      '',
      0,
      0,
    )
    var notifCol = $app.findCollectionByNameOrId('notifications')

    for (var i = 0; i < rhUsers.length; i++) {
      try {
        var notif = new Record(notifCol)
        notif.set('user', rhUsers[i].id)
        notif.set('requisition', requisitionId)
        notif.set('type', 'change_request_submitted')
        notif.set('message', 'Nova solicitação de alteração em uma requisição aprovada')
        notif.set('read', false)
        $app.save(notif)
      } catch (notifItemErr) {
        $app
          .logger()
          .error(
            'change_request_create_notify: notify rh user failed',
            'error',
            String(notifItemErr),
          )
      }
    }

    try {
      var req = $app.findRecordById('requisitions', requisitionId)
      var reqSolicitanteId = req.getString('solicitante')
      if (reqSolicitanteId && reqSolicitanteId !== solicitanteId) {
        req.set('edicao_liberada', true)
        $app.save(req)

        var notifSolicitante = new Record(notifCol)
        notifSolicitante.set('user', reqSolicitanteId)
        notifSolicitante.set('requisition', requisitionId)
        notifSolicitante.set('type', 'change_request_submitted')
        notifSolicitante.set(
          'message',
          'Há uma solicitação de alteração pendente em sua requisição',
        )
        notifSolicitante.set('read', false)
        $app.save(notifSolicitante)
      }
    } catch (reqErr) {
      $app
        .logger()
        .error('change_request_create_notify: requisition update failed', 'error', String(reqErr))
    }
  } catch (notifErr) {
    $app
      .logger()
      .error('change_request_create_notify: notification block failed', 'error', String(notifErr))
  }

  return e.next()
}, 'requisition_change_requests')
