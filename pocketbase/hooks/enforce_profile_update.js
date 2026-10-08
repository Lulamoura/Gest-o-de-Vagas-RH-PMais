onRecordCreateRequest((e) => {
  var actor = null
  try {
    if (e.auth && e.auth.id) actor = $app.findRecordById('users', e.auth.id)
  } catch (_) {}
  if (!actor || !actor.getBool('ativo')) {
    throw e.forbiddenError('Acesso não autorizado.', null)
  }

  var body = e.requestInfo().body || {}
  var isSuperAdmin = actor.getString('profile') === 'superadmin'
  var isAdmin = actor.getString('profile') === 'admin'
  if (!isSuperAdmin && !isAdmin) {
    throw e.forbiddenError('Acesso não autorizado.', null)
  }
  if (!isSuperAdmin && body.profile === 'superadmin') {
    throw e.forbiddenError('Apenas Superadministrador pode criar este perfil.', null)
  }
  if (!isSuperAdmin && 'departamento' in body) {
    throw e.forbiddenError('Apenas Superadministrador pode definir departamento.', null)
  }

  e.record.set('permitir_acesso_fora_pmais', false)
  e.next()
}, 'users')

onRecordUpdateRequest((e) => {
  var body = e.requestInfo().body || {}
  var actor = null
  try {
    if (e.auth && e.auth.id) actor = $app.findRecordById('users', e.auth.id)
  } catch (_) {}
  if (!actor || !actor.getBool('ativo')) {
    throw e.forbiddenError('Acesso não autorizado.', null)
  }

  var isSuperAdmin = actor.getString('profile') === 'superadmin'
  var isSelf = actor.id === e.record.id
  var oldProfile = ''
  try {
    oldProfile = e.record.original().getString('profile')
  } catch (_) {}

  if ('permitir_acesso_fora_pmais' in body) {
    throw e.forbiddenError(
      'A permissão de acesso fora da PMais deve ser alterada pela rota administrativa segura.',
      null,
    )
  }
  if ('departamento' in body && !isSuperAdmin) {
    throw e.forbiddenError('Apenas Superadministrador pode alterar o departamento.', null)
  }
  if (
    'profile' in body &&
    !isSuperAdmin &&
    (isSelf || body.profile === 'superadmin' || oldProfile === 'superadmin')
  ) {
    throw e.forbiddenError('Apenas Superadministrador pode alterar este perfil.', null)
  }
  if ('ativo' in body) {
    throw e.forbiddenError(
      'O estado de acesso deve ser alterado pela rota administrativa segura.',
      null,
    )
  }

  e.next()
}, 'users')

onRecordUpdate((e) => {
  const profile = e.record.getString('profile')
  if (!profile) {
    e.record.set('profile', 'operator')
  }
  e.next()
}, 'users')
