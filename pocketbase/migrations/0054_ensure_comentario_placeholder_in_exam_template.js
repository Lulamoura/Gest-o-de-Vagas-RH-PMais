migrate(
  (app) => {
    try {
      var template = app.findFirstRecordByData('email_templates', 'type', 'encaminhamento_exames')
      var currentBody = template.getString('body')

      if (
        currentBody.indexOf('{comentario}') === -1 &&
        currentBody.indexOf('{{comentario}}') === -1 &&
        currentBody.indexOf('{observacao}') === -1 &&
        currentBody.indexOf('{{observacao}}') === -1
      ) {
        var newBody = currentBody
        if (currentBody.indexOf('Atenciosamente') !== -1) {
          newBody = currentBody.replace(
            'Atenciosamente',
            '<p><strong>Orientações:</strong></p><p>{comentario}</p>Atenciosamente',
          )
        } else {
          newBody = currentBody + '<p><strong>Orientações:</strong></p><p>{comentario}</p>'
        }
        template.set('body', newBody)
        app.save(template)
      }
    } catch (_) {}
  },
  (app) => {},
)
