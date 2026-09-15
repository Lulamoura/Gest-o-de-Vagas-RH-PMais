onMailerRecordPasswordResetSend((e) => {
  try {
    const resendKey = $secrets.get('RESEND_API_KEY')
    if (!resendKey) {
      $app
        .logger()
        .warn('RESEND_API_KEY não configurada para password_reset, prosseguindo com mailer padrão')
      e.next()
      return
    }

    // Identificar dados do remetente a partir de system_parameters
    var senderName = 'PMais RH'
    var senderEmail = 'vagas@pmaisservicos.com.br'
    try {
      var params = $app.findRecordsByFilter('system_parameters', '', 'created', 1, 0)
      if (params.length > 0) {
        var sp = params[0]
        if (sp.getString('nome_remetente')) senderName = sp.getString('nome_remetente')
        if (sp.getString('email_remetente')) senderEmail = sp.getString('email_remetente')
      }
    } catch (_) {}

    var recipientEmail = ''
    if (e.record) {
      recipientEmail = e.record.getString('email') || ''
    }
    if (!recipientEmail && e.message && e.message.to && e.message.to.length > 0) {
      recipientEmail = e.message.to[0].address || ''
    }

    if (!recipientEmail) {
      $app.logger().error('Nenhum destinatário encontrado no evento de reset de senha')
      e.next()
      return
    }

    var token = e.meta && e.meta.token ? e.meta.token : ''
    var userName = e.record ? e.record.getString('name') || 'Usuário' : 'Usuário'

    // Obter URL pública do sistema
    var siteUrl = $secrets.get('SITE_URL') || 'https://vagaspmais.pmaisservicos.com.br'
    // Remover barra final caso exista
    if (siteUrl.endsWith('/')) {
      siteUrl = siteUrl.slice(0, -1)
    }

    var resetLink = siteUrl + '/redefinir-senha?token=' + encodeURIComponent(token)

    var subject = 'Redefinição de Senha — PMais RH'
    var html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .logo { text-align: center; margin-bottom: 24px; }
    .logo-badge { display: inline-block; background: #4f46e5; color: #ffffff; font-weight: 900; font-size: 24px; padding: 12px 20px; border-radius: 12px; }
    h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 16px; text-align: center; }
    p { font-size: 14px; line-height: 1.6; color: #475569; margin: 12px 0; }
    .btn-container { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background: #4f46e5; color: #ffffff !important; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 8px; text-decoration: none; }
    .token-box { background: #f1f5f9; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 12px; font-family: monospace; font-size: 12px; word-break: break-all; margin: 16px 0; color: #334155; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <div class="logo-badge">P+</div>
    </div>
    <h1>Redefinição de Senha</h1>
    <p>Olá <strong>${userName}</strong>,</p>
    <p>Recebemos uma solicitação para redefinir a sua senha de acesso ao <strong>Módulo de Vagas RH — PMais</strong>.</p>
    <p>Clique no botão abaixo para criar uma nova senha:</p>
    <div class="btn-container">
      <a href="${resetLink}" class="btn" target="_blank" rel="noopener noreferrer">Criar Nova Senha</a>
    </div>
    <p style="font-size: 12px; color: #64748b;">Se o botão não funcionar, copie e cole o link a seguir no seu navegador:</p>
    <div class="token-box">${resetLink}</div>
    <p style="font-size: 12px; color: #64748b;">Se você não solicitou a recuperação de senha, ignore este e-mail. Sua senha permanecerá inalterada.</p>
    <div class="footer">
      PMais Terceirização — Gestão de Recursos Humanos<br>
      Este é um e-mail automático, por favor não responda.
    </div>
  </div>
</body>
</html>
    `

    const res = $http.send({
      url: 'https://api.resend.com/emails',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + resendKey,
      },
      body: JSON.stringify({
        from: senderName + ' <' + senderEmail + '>',
        to: [recipientEmail],
        subject: subject,
        html: html,
      }),
      timeout: 15,
    })

    if (res.statusCode >= 200 && res.statusCode < 300) {
      $app
        .logger()
        .info('E-mail de reset de senha enviado via Resend com sucesso para ' + recipientEmail)
      // O e-mail já foi despachado via Resend com template customizado e link da aplicação.
      // NÃO chamamos e.next() para evitar envio duplicado via SMTP interno do PocketBase caso configurado.
      return
    } else {
      $app
        .logger()
        .error(
          'Erro ao enviar e-mail de reset via Resend',
          'status',
          res.statusCode,
          'body',
          res.json,
        )
      // Se Resend falhar por algum motivo, deixa cair no mailer default
      e.next()
    }
  } catch (err) {
    $app.logger().error('Exceção no hook onMailerRecordPasswordResetSend', 'error', String(err))
    e.next()
  }
})
