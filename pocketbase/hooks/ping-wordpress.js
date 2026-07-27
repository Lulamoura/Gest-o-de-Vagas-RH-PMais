routerAdd('POST', '/backend/v1/ping-wordpress', (e) => {
  return e.json(200, { ok: true })
})

try {
  $app
    .logger()
    .info(
      'ping-wordpress: route registered',
      'method',
      'POST',
      'path',
      '/backend/v1/ping-wordpress',
    )
} catch (_) {
  console.log('ping-wordpress: route registered at POST /backend/v1/ping-wordpress')
}
