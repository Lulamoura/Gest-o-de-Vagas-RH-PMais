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
    // Don't fail if history creation fails
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
      var notif = new Record(notifCol)
      notif.set('user', rhUsers[i].id)
      notif.set('requisition', requisitionId)
      notif.set('type', 'change_request_submitted')
      notif.set('message', 'Nova solicitação de alteração em uma requisição aprovada')
      notif.set('read', false)
      $app.save(notif)
    }

    // Also notify the original solicitante of the requisition
    try {
      var req = $app.findRecordById('requisitions', requisitionId)
      var reqSolicitanteId = req.getString('solicitante')
      if (reqSolicitanteId && reqSolicitanteId !== solicitanteId) {
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
      // Don't fail if solicitante notification fails
    }
  } catch (notifErr) {
    // Don't fail if notification creation fails
  }

  return e.next()
}, 'requisition_change_requests')
