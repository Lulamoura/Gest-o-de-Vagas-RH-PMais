migrate(
  (app) => {
    // 1. Update email_templates type select field to include 'aviso_integracao'
    const col = app.findCollectionByNameOrId('email_templates')
    const typeField = col.fields.getByName('type')
    if (typeField) {
      const currentValues = typeField.values || []
      if (!currentValues.includes('aviso_integracao')) {
        currentValues.push('aviso_integracao')
        typeField.values = currentValues
        typeField.maxSelect = 1
        app.save(col)
      }
    }

    // 2. Insert default template for aviso_integracao if not already present
    const defaultSubject = 'Novo Candidato para Integração - PMais Terceirização'
    const defaultBody =
      '<p>Olá,</p>' +
      '<p>Um novo candidato entrou na página de integração para ser devidamente integrado e se tornar o mais novo membro da equipe PMais Terceirização.</p>' +
      '<p><strong>Candidato:</strong> {candidate_name}</p>' +
      '<p><strong>Vaga:</strong> {vacancy_name}</p>' +
      '<p><strong>Cliente:</strong> {client_name}</p>' +
      '<p>Por favor, providenciem as devidas orientações para a integração.</p>' +
      '<p>Atenciosamente,<br>Equipe RH PMais</p>'

    try {
      app.findFirstRecordByData('email_templates', 'type', 'aviso_integracao')
    } catch (_) {
      const templatesCol = app.findCollectionByNameOrId('email_templates')
      const rec = new Record(templatesCol)
      rec.set('type', 'aviso_integracao')
      rec.set('subject', defaultSubject)
      rec.set('body', defaultBody)
      app.save(rec)
    }

    // 3. Clean up test/homologation addresses from system_parameters
    try {
      const params = app.findRecordsByFilter('system_parameters', '', 'created', 10, 0)
      for (const sp of params) {
        let changed = false
        const filterValid = (rawStr) => {
          if (!rawStr) return ''
          const list = rawStr
            .split(',')
            .map((s) => s.trim())
            .filter((s) => {
              if (!s) return false
              const lower = s.toLowerCase()
              // Remove fake/typo/test domains
              if (
                lower.includes('@pmaiservicos.com.br') || // typo with 1 's'
                lower.includes('@pmaissservicos.com.br') || // typo with 3 's'
                lower.includes('@test.com') ||
                lower.includes('@example.com')
              ) {
                return false
              }
              return true
            })
          return list.join(', ')
        }

        const dpLista = sp.getString('email_dp_lista')
        const newDpLista = filterValid(dpLista)
        if (dpLista !== newDpLista) {
          sp.set('email_dp_lista', newDpLista)
          changed = true
        }

        const opLista = sp.getString('email_operacional_lista')
        const newOpLista = filterValid(opLista)
        if (opLista !== newOpLista) {
          sp.set('email_operacional_lista', newOpLista)
          changed = true
        }

        const comLista = sp.getString('email_comercial')
        const newComLista = filterValid(comLista)
        if (comLista !== newComLista) {
          sp.set('email_comercial', newComLista)
          changed = true
        }

        if (changed) {
          app.save(sp)
        }
      }
    } catch (_) {}
  },
  (app) => {
    // Revert template record if needed
    try {
      const rec = app.findFirstRecordByData('email_templates', 'type', 'aviso_integracao')
      app.delete(rec)
    } catch (_) {}
  },
)
