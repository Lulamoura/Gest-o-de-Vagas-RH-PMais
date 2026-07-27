onRecordCreate((e) => {
  const profile = e.record.getString('profile')
  if (profile === 'admin' || profile === 'superadmin' || profile === '') {
    e.record.set('profile', 'viewer')
  }
  e.next()
}, 'users')
