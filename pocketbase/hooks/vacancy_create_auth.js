onRecordCreateRequest((e) => {
  try {
    e.set('authUserId', e.auth ? e.auth.id : '')
  } catch (_) {}
  e.next()
}, 'vacancies')
