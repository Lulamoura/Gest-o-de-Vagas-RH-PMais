routerAdd(
  'POST',
  '/backend/v1/requisition-change-requests/{id}/decide',
  (e) => {
    try {
      var id = e.request.pathValue('id')
      var body = e.requestInfo().body || {}
      var newStatus = body.status || ''
      var decisaoComentario = body.decisao_comentario || ''

      if (newStatus !== 'Aprovada' && newStatus !== 'Reprovada') {
        return e.badRequestError('Status inválido. Use Aprovada ou Reprovada.')
      }

      var userProfile = e.auth ? e.auth.getString('profile') : ''
      if (userProfile !== 'admin' && userProfile !== 'superadmin') {
        return e.forbiddenError('Apenas usuários RH podem decidir solicitações de alteração')
      }

      var cr
      try {
        cr = $app.findRecordById('requisition_change_requests', id)
      } catch (findErr) {
        return e.notFoundError('Solicitação de alteração não encontrada')
      }

      if (cr.getString('status') !== 'Pendente') {
        return e.badRequestError('Esta solicitação já foi decidida')
      }

      var requisitionId = cr.getString('requisition')
      var crSolicitanteId = cr.getString('solicitante')
      var userId = e.auth ? e.auth.id : ''

      cr.set('status', newStatus)
      cr.set('decidido_por', userId)
      cr.set('decidido_em', new Date().toISOString())
      if (decisaoComentario) {
        cr.set('decisao_comentario', decisaoComentario)
      }
      $app.save(cr)

      var reqSolicitanteId = crSolicitanteId
      try {
        var req = $app.findRecordById('requisitions', requisitionId)
        reqSolicitanteId = req.getString('solicitante')

        if (newStatus === 'Aprovada') {
          req.set('edicao_liberada', true)
          $app.save(req)
        }
      } catch (reqErr) {
        $app
          .logger()
          .error('change_request_decide: requisition update failed', 'error', String(reqErr))
      }

      try {
        var historyCol = $app.findCollectionByNameOrId('requisition_history')
        var historyRecord = new Record(historyCol)
        historyRecord.set('requisition_id', requisitionId)
        historyRecord.set('usuario_id', userId)
        historyRecord.set('status_novo', 'Aprovada')
        historyRecord.set(
          'acao',
          newStatus === 'Aprovada' ? 'alteracao_aprovada' : 'alteracao_reprovada',
        )
        historyRecord.set('observacao', decisaoComentario || '')
        $app.save(historyRecord)
      } catch (histErr) {
        $app.logger().error('change_request_decide: history failed', 'error', String(histErr))
      }

      try {
        var notifCol = $app.findCollectionByNameOrId('notifications')
        var notif = new Record(notifCol)
        notif.set('user', reqSolicitanteId)
        notif.set('requisition', requisitionId)
        notif.set(
          'type',
          newStatus === 'Aprovada' ? 'change_request_approved' : 'change_request_reproved',
        )
        notif.set(
          'message',
          newStatus === 'Aprovada'
            ? 'Sua solicitação de alteração foi aprovada. A edição da requisição foi liberada para você ajustar os campos.'
            : 'Sua solicitação de alteração foi reprovada',
        )
        notif.set('read', false)
        $app.save(notif)
      } catch (notifErr) {
        $app.logger().error('change_request_decide: notification failed', 'error', String(notifErr))
      }

      return e.json(200, { success: true, status: newStatus })
    } catch (err) {
      $app.logger().error('change_request_decide: unexpected error', 'error', String(err))
      return e.internalServerError('Erro ao processar decisão')
    }
  },
  $apis.requireAuth(),
)
