onRecordUpdateRequest((e) => {
  var body = e.requestInfo().body || {}
  var newStatus = body.status_candidato

  if (newStatus !== 'Integrado') {
    e.next()
    return
  }

  var oldStatus = e.record.getString('status_candidato')
  if (oldStatus === 'Integrado') {
    e.next()
    return
  }

  if (!e.auth) {
    throw new ForbiddenError('Você não tem permissão para integrar candidatos.')
  }

  var profile = e.auth.getString('profile')

  if (profile === 'admin' || profile === 'superadmin') {
    e.next()
    return
  }

  if (profile === 'operator') {
    var userDeptId = e.auth.getString('departamento')
    try {
      var dpDept = $app.findFirstRecordByData('departamentos', 'nome', 'DP')
      if (userDeptId === dpDept.id) {
        e.next()
        return
      }
    } catch (_) {}
  }

  throw new ForbiddenError('Você não tem permissão para integrar candidatos.')
}, 'candidates')
