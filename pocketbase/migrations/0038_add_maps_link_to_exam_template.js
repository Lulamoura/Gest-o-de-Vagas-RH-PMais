migrate(
  (app) => {
    try {
      var template = app.findFirstRecordByData('email_templates', 'type', 'encaminhamento_exames')
      var currentBody = template.getString('body')

      if (
        currentBody.indexOf('maps_link_html') === -1 &&
        currentBody.indexOf('google.com/maps') === -1
      ) {
        var newBody = currentBody
        if (currentBody.indexOf('{clinica_endereco}</p>') !== -1) {
          newBody = currentBody.replace(
            '{clinica_endereco}</p>',
            '{clinica_endereco}</p>{maps_link_html}',
          )
        } else if (currentBody.indexOf('{{clinica_endereco}}</p>') !== -1) {
          newBody = currentBody.replace(
            '{{clinica_endereco}}</p>',
            '{{clinica_endereco}}</p>{{maps_link_html}}',
          )
        } else {
          newBody = currentBody + '{maps_link_html}'
        }
        template.set('body', newBody)
        app.save(template)
      }
    } catch (_) {}
  },
  (app) => {},
)
