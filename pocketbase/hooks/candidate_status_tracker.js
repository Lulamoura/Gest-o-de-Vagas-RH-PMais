onRecordAfterUpdateSuccess((e) => {
  var record = e.record

  var oldStatus = ''
  var newStatus = record.getString('status_candidato')

  try {
    oldStatus = record.original().getString('status_candidato')
  } catch (_) {
    e.next()
    return
  }

  if (oldStatus === newStatus) {
    e.next()
    return
  }

  var userId = ''
  try {
    userId = e.get('authUserId') || ''
  } catch (_) {}

  try {
    var historyCol = $app.findCollectionByNameOrId('candidate_history')
    var historyRecord = new Record(historyCol)
    historyRecord.set('vacancy_id', record.getString('vacancy_id'))
    historyRecord.set('candidate_id', record.id)
    if (userId) {
      historyRecord.set('usuario_id', userId)
    }
    historyRecord.set('status_anterior', oldStatus)
    historyRecord.set('status_novo', newStatus)
    $app.save(historyRecord)
  } catch (err) {
    $app.logger().error('failed to log candidate status change', 'error', err.message)
  }

  e.next()
}, 'candidates')
