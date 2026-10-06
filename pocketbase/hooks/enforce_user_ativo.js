/**
 * Bloqueia a autenticação e renovação de sessão de usuários inativos (ativo = false).
 * Lança ForbiddenError com mensagem clara solicitando contato com o administrador.
 */
onRecordAuthRequest((e) => {
  if (e.record) {
    var ativo = e.record.get('ativo')
    if (ativo === false || ativo === 0 || ativo === '0') {
      throw new ForbiddenError('Usuário inativo. Contate o administrador.')
    }
  }
  e.next()
}, 'users')
