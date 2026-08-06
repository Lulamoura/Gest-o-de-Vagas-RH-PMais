onRecordUpdateRequest((e) => {
  const authProfile = e.auth ? e.auth.getString('profile') : ''

  if (authProfile === 'superadmin') {
    e.next()
    return
  }

  const systemDepartments = ['DP', 'RH', 'Comercial', 'Operacional']
  const currentName = e.record.getString('nome')
  const body = e.requestInfo().body || {}

  if ('nome' in body && systemDepartments.includes(currentName)) {
    const newName = body.nome || ''
    if (newName !== currentName) {
      e.badRequestError(
        'Apenas Super Admin pode renomear departamentos do sistema (DP, RH, Comercial, Operacional).',
      )
      return
    }
  }

  e.next()
}, 'departamentos')
