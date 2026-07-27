migrate(
  (app) => {
    const TEMP_PASSWORD = 'Troca@123'

    try {
      const user = app.findAuthRecordByEmail('_pb_users_auth_', 'luiz.moura@pmaisservicos.com.br')
      user.setPassword(TEMP_PASSWORD)
      app.save(user)
      console.log('SECURITY: Superuser password has been reset to the temporary value.')
      console.log('SECURITY: Please log in and change it immediately via Profile > Alterar Senha.')
    } catch (_) {
      console.log(
        'SECURITY: Superuser not found (email deleted or changed). Skipping password reset.',
      )
    }
  },
  (app) => {
    // No-op: reverting a password reset is not meaningful.
  },
)
