migrate(
  (app) => {
    var departamentosCol = app.findCollectionByNameOrId('departamentos')
    var deptMap = {}

    var defaultDepts = ['comercial', 'operacional', 'rh']
    for (var i = 0; i < defaultDepts.length; i++) {
      var deptName = defaultDepts[i]
      try {
        var existing = app.findFirstRecordByData('departamentos', 'nome', deptName)
        deptMap[deptName] = existing.id
      } catch (_) {
        var record = new Record(departamentosCol)
        record.set('nome', deptName)
        app.save(record)
        deptMap[deptName] = record.id
      }
    }

    var usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    var users = app.findRecordsByFilter('_pb_users_auth_', 'id != ""', '', 0, 0)
    var userDeptValues = {}
    for (var i = 0; i < users.length; i++) {
      userDeptValues[users[i].id] = users[i].getString('departamento')
    }

    usersCol.fields.removeByName('departamento')
    usersCol.fields.add(
      new RelationField({
        name: 'departamento',
        collectionId: departamentosCol.id,
        maxSelect: 1,
        cascadeDelete: false,
      }),
    )
    app.save(usersCol)

    for (var userId in userDeptValues) {
      var deptVal = userDeptValues[userId]
      if (deptVal && deptMap[deptVal]) {
        app
          .db()
          .newQuery('UPDATE users SET departamento = {:deptId} WHERE id = {:userId}')
          .bind({ deptId: deptMap[deptVal], userId: userId })
          .execute()
      }
    }

    var reqCol = app.findCollectionByNameOrId('requisitions')
    var requisitions = app.findRecordsByFilter('requisitions', 'id != ""', '', 0, 0)
    var reqDeptValues = {}
    for (var j = 0; j < requisitions.length; j++) {
      reqDeptValues[requisitions[j].id] = requisitions[j].getString('departamento')
    }

    reqCol.fields.removeByName('departamento')
    reqCol.fields.add(
      new RelationField({
        name: 'departamento',
        collectionId: departamentosCol.id,
        maxSelect: 1,
        cascadeDelete: false,
      }),
    )
    app.save(reqCol)

    for (var reqId in reqDeptValues) {
      var deptVal2 = reqDeptValues[reqId]
      if (deptVal2 && deptMap[deptVal2]) {
        app
          .db()
          .newQuery('UPDATE requisitions SET departamento = {:deptId} WHERE id = {:reqId}')
          .bind({ deptId: deptMap[deptVal2], reqId: reqId })
          .execute()
      }
    }
  },
  (app) => {
    try {
      var usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      usersCol.fields.removeByName('departamento')
      usersCol.fields.add(
        new SelectField({
          name: 'departamento',
          values: ['comercial', 'operacional', 'rh'],
          maxSelect: 1,
        }),
      )
      app.save(usersCol)
    } catch (_) {}

    try {
      var reqCol = app.findCollectionByNameOrId('requisitions')
      reqCol.fields.removeByName('departamento')
      reqCol.fields.add(
        new SelectField({
          name: 'departamento',
          values: ['comercial', 'operacional', 'rh'],
          maxSelect: 1,
        }),
      )
      app.save(reqCol)
    } catch (_) {}
  },
)
