migrate(
  (app) => {
    const tiposVagaColId = app.findCollectionByNameOrId('tipos_vaga').id
    const tiposContratoColId = app.findCollectionByNameOrId('tipos_contrato').id

    const col = app.findCollectionByNameOrId('candidates')

    if (!col.fields.getByName('tipo_vaga')) {
      col.fields.add(
        new RelationField({
          name: 'tipo_vaga',
          required: false,
          collectionId: tiposVagaColId,
          cascadeDelete: false,
          minSelect: 0,
          maxSelect: 1,
        }),
      )
    }

    if (!col.fields.getByName('tipo_contrato')) {
      col.fields.add(
        new RelationField({
          name: 'tipo_contrato',
          required: false,
          collectionId: tiposContratoColId,
          cascadeDelete: false,
          minSelect: 0,
          maxSelect: 1,
        }),
      )
    }

    app.save(col)

    // Backfill existing candidates from their associated vacancy.
    // Iterate in batches to avoid loading everything at once.
    var batchLimit = 200
    var offset = 0
    var hasMore = true
    var missingVacancyCount = 0

    while (hasMore) {
      var candidates = app.findRecordsByFilter('candidates', '', 'created', batchLimit, offset)
      if (!candidates || candidates.length === 0) {
        hasMore = false
        break
      }

      for (var i = 0; i < candidates.length; i++) {
        var candidate = candidates[i]
        var vacancyId = candidate.getString('vacancy_id')

        if (!vacancyId) {
          missingVacancyCount++
          try {
            app
              .logger()
              .info('0058_backfill: candidate without vacancy_id', 'candidateId', candidate.id)
          } catch (_) {}
          continue
        }

        var vacancy = null
        try {
          vacancy = app.findRecordById('vacancies', vacancyId)
        } catch (vacErr) {
          missingVacancyCount++
          try {
            app
              .logger()
              .info(
                '0058_backfill: vacancy not found for candidate',
                'candidateId',
                candidate.id,
                'vacancyId',
                vacancyId,
              )
          } catch (_) {}
          continue
        }

        var vacancyTipoVaga = vacancy.getString('tipo_vaga')
        var vacancyTipoContrato = vacancy.getString('tipo_contrato')

        var changed = false
        if (vacancyTipoVaga && !candidate.getString('tipo_vaga')) {
          candidate.set('tipo_vaga', vacancyTipoVaga)
          changed = true
        }
        if (vacancyTipoContrato && !candidate.getString('tipo_contrato')) {
          candidate.set('tipo_contrato', vacancyTipoContrato)
          changed = true
        }

        if (changed) {
          try {
            app.save(candidate)
          } catch (saveErr) {
            try {
              app
                .logger()
                .error(
                  '0058_backfill: failed to save candidate',
                  'candidateId',
                  candidate.id,
                  'error',
                  saveErr.message || String(saveErr),
                )
            } catch (_) {}
          }
        }
      }

      if (candidates.length < batchLimit) {
        hasMore = false
      } else {
        offset += batchLimit
      }
    }

    try {
      app.logger().info('0058_backfill: completed', 'missingVacancyCount', missingVacancyCount)
    } catch (_) {}
  },
  (app) => {
    const col = app.findCollectionByNameOrId('candidates')

    var tipoVagaField = col.fields.getByName('tipo_vaga')
    if (tipoVagaField) {
      col.fields.remove(tipoVagaField)
    }

    var tipoContratoField = col.fields.getByName('tipo_contrato')
    if (tipoContratoField) {
      col.fields.remove(tipoContratoField)
    }

    app.save(col)
  },
)
