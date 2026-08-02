onRecordAfterCreateSuccess((e) => {
  var comment = e.record
  var requisitionId = comment.getString('requisition_id')
  var commentAuthorId = comment.getString('usuario_id')

  try {
    var req = $app.findRecordById('requisitions', requisitionId)
    var solicitanteId = req.getString('solicitante')

    var notifyUserIds = {}

    if (solicitanteId && solicitanteId !== commentAuthorId) {
      notifyUserIds[solicitanteId] = true
    }

    var rhUsers = $app.findRecordsByFilter(
      'users',
      "profile = 'admin' || profile = 'superadmin'",
      '',
      0,
      0,
    )
    for (var i = 0; i < rhUsers.length; i++) {
      var uid = rhUsers[i].id
      if (uid !== commentAuthorId) {
        notifyUserIds[uid] = true
      }
    }

    var notifCol = $app.findCollectionByNameOrId('notifications')
    for (var userId in notifyUserIds) {
      var notif = new Record(notifCol)
      notif.set('user', userId)
      notif.set('requisition', requisitionId)
      notif.set('type', 'new_comment')
      notif.set('message', 'Novo comentário em uma requisição')
      notif.set('read', false)
      $app.save(notif)
    }
  } catch (err) {
    // Don't fail if notification creation fails
  }

  return e.next()
}, 'requisition_comments')
