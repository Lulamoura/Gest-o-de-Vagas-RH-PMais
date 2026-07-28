onRecordAfterCreateSuccess((e) => {
  var record = e.record

  var userId = ''
  try {
    userId = e.get('authUserId') || ''
  } catch (_) {}

  try {
    var historyCol = $app.findCollectionByNameOrId('pipeline_history')
    var historyRecord = new Record(historyCol)
    historyRecord.set('vacancy_id', record.id)
    if (userId) {
      historyRecord.set('usuario_id', userId)
    }
    historyRecord.set('status_anterior', '')
    historyRecord.set('status_novo', 'Aberta')
    $app.save(historyRecord)
  } catch (err) {
    $app.logger().error('failed to log vacancy creation', 'error', err.message)
  }

  e.next()
}, 'vacancies')
