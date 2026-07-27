// Migration 0014: Reset superuser password to a known temporary value.
// IMPORTANT: The user MUST change this password immediately after first login
// via Profile > Alterar Senha. The temporary password below is a placeholder
// that should be replaced with a user-provided value before publishing.
migrate(
  (app) => {
    const TEMP_PASSWORD = 'Temp@123456'

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
    // The user should set a permanent password via the profile page after login.
  },
)
