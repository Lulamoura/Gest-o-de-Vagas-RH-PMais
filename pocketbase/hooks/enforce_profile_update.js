onRecordUpdate((e) => {
  const newProfile = e.record.getString('profile')
  const oldProfile = e.record.original().getString('profile')
  if (newProfile !== oldProfile) {
    if (newProfile === 'admin' || newProfile === 'superadmin') {
      e.record.set('profile', oldProfile || 'viewer')
    }
  }
  e.next()
}, 'users')
