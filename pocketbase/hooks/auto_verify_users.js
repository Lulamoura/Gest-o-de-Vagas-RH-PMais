onRecordCreate((e) => {
  e.record.setVerified(true)
  e.next()
}, 'users')
