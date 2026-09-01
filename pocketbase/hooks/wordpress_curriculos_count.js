routerAdd('POST', '/backend/v1/vagas/wordpress/curriculos', (e) => {
  var authHeader = e.request.header.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) {
    return e.json(401, { ok: false, message: 'Acesso não autorizado' })
  }

  var token = authHeader.slice(7).trim()
  var expectedToken = $secrets.get('WORDPRESS_INTEGRATION_TOKEN') || ''
  if (!expectedToken || token !== expectedToken) {
    return e.json(401, { ok: false, message: 'Acesso não autorizado' })
  }

  var body = e.requestInfo().body || {}
  var jobId = String(body.wordpress_job_id || '').trim()
  var count = Number(body.wordpress_curriculos_count)

  if (!jobId) return e.badRequestError('wordpress_job_id é obrigatório')
  if (!Number.isFinite(count) || Math.floor(count) !== count || count < 0) {
    return e.badRequestError('wordpress_curriculos_count deve ser um inteiro não negativo')
  }

  var vacancy = null
  try {
    vacancy = $app.findFirstRecordByData('vacancies', 'wordpress_job_id', jobId)
  } catch (_) {
    return e.notFoundError('Vaga não encontrada')
  }

  vacancy.set('wordpress_curriculos_count', count)
  vacancy.set('wordpress_curriculos_synced_at', new Date().toISOString())
  $app.save(vacancy)

  return e.json(200, {
    ok: true,
    wordpress_job_id: jobId,
    wordpress_curriculos_count: count,
    vacancy_id: vacancy.id,
  })
})
