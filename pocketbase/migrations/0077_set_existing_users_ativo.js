migrate(
  (app) => {
    // 0076 adicionou a coluna 'ativo', mas no SQLite novos booleanos foram inicializados como 0 / false
    // Atualiza todos os usuários existentes para ativo = 1 (true)
    app.db().newQuery('UPDATE users SET ativo = 1').execute()
  },
  (app) => {
    // Reversão
  },
)
