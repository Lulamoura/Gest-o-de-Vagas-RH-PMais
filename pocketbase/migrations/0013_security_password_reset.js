migrate(
  (app) => {
    try {
      const user = app.findAuthRecordByEmail('_pb_users_auth_', 'luiz.moura@pmaisservicos.com.br')
      const newPassword = $security.randomString(24)
      user.setPassword(newPassword)
      app.save(user)
      console.log('SECURITY: Admin password has been reset. New temporary password: ' + newPassword)
      console.log(
        'SECURITY: Please log in with the new password and change it immediately via Profile > Alterar Senha.',
      )
    } catch (_) {
      console.log('SECURITY: Admin user not found, skipping password reset.')
    }
  },
  (app) => {},
)
