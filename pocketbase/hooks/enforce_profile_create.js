onRecordCreate((e) => {
  const profile = e.record.getString('profile')
  if (!profile) {
    e.record.set('profile', 'operator')
  }
  e.next()
}, 'users')
