routerAdd(
  'POST',
  '/backend/v1/requisitions/{id}/status',
  (e) => {
    var id = e.request.pathValue('id')
    var body = e.requestInfo().body || {}
    var newStatus = body.status || ''
    var observacao = body.observacao || ''

    var validStatuses = ['Aguardando aprovação', 'Em análise', 'Aprovada', 'Reprovada', 'Cancelada']
    var isValid = false
    for (var i = 0; i < validStatuses.length; i++) {
      if (validStatuses[i] === newStatus) {
        isValid = true
        break
      }
    }
    if (!isValid) {
      return e.badRequestError('Status inválido: ' + newStatus)
    }

    var req = $app.findRecordById('requisitions', id)
    var oldStatus = req.getString('status')

    var userId = e.auth ? e.auth.id : ''
    var userProfile = e.auth ? e.auth.getString('profile') : ''
    var userDepto = e.auth ? e.auth.getString('departamento') : ''
    var isSolicitante = req.getString('solicitante') === userId
    var isAdmin = userProfile === 'admin' || userProfile === 'superadmin'
    var isRH = userDepto === 'rh'

    var allowed = false
    var acao = ''

    if (newStatus === 'Aguardando aprovação' && oldStatus === 'Rascunho' && isSolicitante) {
      var requiredFields = [
        'cliente',
        'cargo',
        'cidade',
        'tipo_vaga',
        'tipo_contrato',
        'departamento',
        'prazo_desejado',
        'prioridade',
        'faixa_salarial',
        'justificativa',
        'especificacoes',
        'numero_oe',
      ]
      var missingFields = []
      for (var j = 0; j < requiredFields.length; j++) {
        var val = req.getString(requiredFields[j])
        if (!val || val === '') {
          missingFields.push(requiredFields[j])
        }
      }
      var qtdVagas = req.getInt('quantidade_vagas')
      if (qtdVagas < 1) {
        missingFields.push('quantidade_vagas')
      }
      if (missingFields.length > 0) {
        return e.badRequestError('Campos obrigatórios não preenchidos: ' + missingFields.join(', '))
      }
      allowed = true
      acao = 'Envio para aprovação'
    } else if (
      newStatus === 'Cancelada' &&
      (oldStatus === 'Rascunho' || oldStatus === 'Aguardando aprovação') &&
      isSolicitante
    ) {
      allowed = true
      acao = 'Cancelamento'
    } else if (
      newStatus === 'Em análise' &&
      oldStatus === 'Aguardando aprovação' &&
      (isAdmin || isRH)
    ) {
      allowed = true
      acao = 'Início de análise'
    } else if (
      newStatus === 'Aprovada' &&
      (oldStatus === 'Aguardando aprovação' || oldStatus === 'Em análise') &&
      (isAdmin || isRH)
    ) {
      allowed = true
      acao = 'Aprovação'
    } else if (
      newStatus === 'Reprovada' &&
      (oldStatus === 'Aguardando aprovação' || oldStatus === 'Em análise') &&
      (isAdmin || isRH)
    ) {
      allowed = true
      acao = 'Reprovação'
    }

    if (!allowed) {
      return e.forbiddenError('Você não tem permissão para esta ação')
    }

    if (newStatus === 'Aguardando aprovação' && req.getBool('edicao_liberada')) {
      req.set('edicao_liberada', false)
    }

    req.set('status', newStatus)
    $app.save(req)

    var historyCol = $app.findCollectionByNameOrId('requisition_history')
    var historyRecord = new Record(historyCol)
    historyRecord.set('requisition_id', id)
    historyRecord.set('usuario_id', userId)
    historyRecord.set('status_anterior', oldStatus)
    historyRecord.set('status_novo', newStatus)
    historyRecord.set('acao', acao)
    historyRecord.set('observacao', observacao)
    $app.save(historyRecord)

    try {
      var notifCol = $app.findCollectionByNameOrId('notifications')
      var notifyUserIds = []
      var notifType = ''
      var notifMsg = ''

      if (newStatus === 'Aguardando aprovação') {
        notifType = 'requisition_submitted'
        notifMsg = 'Nova requisição aguardando aprovação'
        var rhUsers = $app.findRecordsByFilter(
          'users',
          "profile = 'admin' || profile = 'superadmin'",
          '',
          0,
          0,
        )
        for (var n = 0; n < rhUsers.length; n++) {
          notifyUserIds.push(rhUsers[n].id)
        }
      } else if (newStatus === 'Aprovada') {
        notifType = 'requisition_approved'
        notifMsg = 'Sua requisição foi aprovada'
        notifyUserIds.push(req.getString('solicitante'))
      } else if (newStatus === 'Reprovada') {
        notifType = 'requisition_reproved'
        notifMsg = 'Sua requisição foi reprovada'
        notifyUserIds.push(req.getString('solicitante'))
      }

      for (var m = 0; m < notifyUserIds.length; m++) {
        var notifRecord = new Record(notifCol)
        notifRecord.set('user', notifyUserIds[m])
        notifRecord.set('requisition', id)
        notifRecord.set('type', notifType)
        notifRecord.set('message', notifMsg)
        notifRecord.set('read', false)
        $app.save(notifRecord)
      }
    } catch (notifErr) {
      // Don't fail the request if notification creation fails
    }

    return e.json(200, { success: true, oldStatus: oldStatus, newStatus: newStatus })
  },
  $apis.requireAuth(),
)
