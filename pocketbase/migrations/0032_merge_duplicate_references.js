migrate(
  (app) => {
    var STATES = [
      'AC',
      'AL',
      'AP',
      'AM',
      'BA',
      'CE',
      'DF',
      'ES',
      'GO',
      'MA',
      'MT',
      'MS',
      'MG',
      'PA',
      'PB',
      'PR',
      'PE',
      'PI',
      'RJ',
      'RN',
      'RS',
      'RO',
      'RR',
      'SC',
      'SP',
      'SE',
      'TO',
    ]

    var PMAIS_ALIASES = {
      'p mais': 'pmais servicos',
      pmais: 'pmais servicos',
      'pmais servicos': 'pmais servicos',
      'p mais terceiracao': 'pmais servicos',
      'pmais terceirizacao': 'pmais servicos',
      'p mais servicos': 'pmais servicos',
      'p mais servico': 'pmais servicos',
      'pmais servico': 'pmais servicos',
      'pmais terceiracao': 'pmais servicos',
      'pmais terceiracao servicos': 'pmais servicos',
      'pmais servicos terceirizacao': 'pmais servicos',
      'pmais servicos terceiracao': 'pmais servicos',
    }

    var stripAccents = function (s) {
      if (!s) return ''
      var m = {
        á: 'a',
        à: 'a',
        â: 'a',
        ã: 'a',
        ä: 'a',
        é: 'e',
        è: 'e',
        ê: 'e',
        ë: 'e',
        í: 'i',
        ì: 'i',
        î: 'i',
        ï: 'i',
        ó: 'o',
        ò: 'o',
        ô: 'o',
        õ: 'o',
        ö: 'o',
        ú: 'u',
        ù: 'u',
        û: 'u',
        ü: 'u',
        ç: 'c',
        ñ: 'n',
        Á: 'A',
        À: 'A',
        Â: 'A',
        Ã: 'A',
        Ä: 'A',
        É: 'E',
        È: 'E',
        Ê: 'E',
        Ë: 'E',
        Í: 'I',
        Ì: 'I',
        Î: 'I',
        Ï: 'I',
        Ó: 'O',
        Ò: 'O',
        Ô: 'O',
        Õ: 'O',
        Ö: 'O',
        Ú: 'U',
        Ù: 'U',
        Û: 'U',
        Ü: 'U',
        Ç: 'C',
        Ñ: 'N',
      }
      var r = ''
      for (var i = 0; i < s.length; i++) {
        r += m[s.charAt(i)] || s.charAt(i)
      }
      return r
    }

    var normalizeKey = function (str) {
      if (!str) return ''
      var s = String(str).trim()
      try {
        s = s.normalize('NFC')
      } catch (_) {}
      s = stripAccents(s)
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .trim()
      return s
    }

    var normalizeCityDisplay = function (raw) {
      if (!raw) return ''
      var s = String(raw).trim()
      try {
        s = s.normalize('NFC')
      } catch (_) {}
      var m = s.match(/^(.+?)[\s,\-/]+([A-Za-z]{2})\s*$/)
      if (m && STATES.indexOf(m[2].toUpperCase()) !== -1)
        return m[1].trim() + ' - ' + m[2].toUpperCase()
      return s
    }

    var getEffectiveKey = function (col, name) {
      var key = normalizeKey(name)
      if (col === 'clientes' && PMAIS_ALIASES[key]) return PMAIS_ALIASES[key]
      return key
    }

    var COLLECTIONS = [
      { name: 'clientes', field: 'cliente', isCity: false },
      { name: 'cargos', field: 'cargo', isCity: false },
      { name: 'cidades', field: 'cidade', isCity: true },
    ]

    for (var ci = 0; ci < COLLECTIONS.length; ci++) {
      var cfg = COLLECTIONS[ci]
      var records = []
      try {
        records = app.findRecordsByFilter(cfg.name, "id != ''", 'id', 0, 0)
      } catch (err) {
        console.log('Error fetching records from ' + cfg.name + ': ' + String(err))
        throw err
      }

      var groups = {}
      for (var ri = 0; ri < records.length; ri++) {
        var rec = records[ri]
        var display = cfg.isCity
          ? normalizeCityDisplay(rec.getString('nome'))
          : rec.getString('nome')
        var key = getEffectiveKey(cfg.name, display)
        if (!key) continue
        if (!groups[key]) groups[key] = []
        groups[key].push(rec)
      }

      var updates = []

      for (var gk in groups) {
        if (!groups.hasOwnProperty(gk)) continue
        var group = groups[gk]
        if (group.length <= 1) continue

        group.sort(function (a, b) {
          if (a.id < b.id) return -1
          if (a.id > b.id) return 1
          return 0
        })

        var canonical = group[0]

        for (var di = 1; di < group.length; di++) {
          updates.push({
            collection: cfg.name,
            field: cfg.field,
            duplicateId: group[di].id,
            canonicalId: canonical.id,
            duplicateRecord: group[di],
          })
        }
      }

      for (var ui = 0; ui < updates.length; ui++) {
        var upd = updates[ui]
        try {
          app
            .db()
            .newQuery(
              'UPDATE vacancies SET ' +
                upd.field +
                ' = {:canonicalId} WHERE ' +
                upd.field +
                ' = {:dupId}',
            )
            .bind({ canonicalId: upd.canonicalId, dupId: upd.duplicateId })
            .execute()
        } catch (err) {
          console.log(
            'Error updating vacancies for ' +
              upd.collection +
              ' (duplicate ' +
              upd.duplicateId +
              ' -> canonical ' +
              upd.canonicalId +
              '): ' +
              String(err),
          )
          throw err
        }
      }

      for (var udi = 0; udi < updates.length; udi++) {
        var dup = updates[udi]
        try {
          app.delete(dup.duplicateRecord)
        } catch (err) {
          console.log(
            'Error deleting duplicate ' +
              dup.duplicateId +
              ' from ' +
              dup.collection +
              ': ' +
              String(err),
          )
          throw err
        }
      }
    }
  },
  (app) => {
    // Non-reversible: the down migration cannot restore deleted duplicates.
    // This is a data cleanup migration; once merged, the duplicates are gone.
  },
)
