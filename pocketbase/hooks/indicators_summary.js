routerAdd(
  'GET',
  '/backend/v1/indicators/summary',
  (e) => {
    var vacancies = $app.findRecordsByFilter('vacancies', '', '-created', 0, 0)
    var candidates = $app.findRecordsByFilter('candidates', '', '-created', 0, 0)

    var openVacancies = 0
    var closedVacancies = 0
    var totalCandidates = 0
    var docExameCandidates = 0

    for (var i = 0; i < vacancies.length; i++) {
      var vStatus = vacancies[i].getString('status_vaga')
      if (vStatus === 'Concluída' || vStatus === 'Cancelada') {
        closedVacancies++
      } else {
        openVacancies++
      }
    }

    for (var j = 0; j < candidates.length; j++) {
      totalCandidates++
      var cStatus = candidates[j].getString('status_candidato')
      if (cStatus === 'Documentação e exame') {
        docExameCandidates++
      }
    }

    var vacancyIdsWithDocExame = {}
    for (var k = 0; k < candidates.length; k++) {
      var cStatus2 = candidates[k].getString('status_candidato')
      if (cStatus2 === 'Documentação e exame') {
        var vId = candidates[k].getString('vacancy_id')
        vacancyIdsWithDocExame[vId] = true
      }
    }

    var openVacancyIds = {}
    for (var m = 0; m < vacancies.length; m++) {
      var vStatus2 = vacancies[m].getString('status_vaga')
      if (vStatus2 !== 'Concluída' && vStatus2 !== 'Cancelada') {
        openVacancyIds[vacancies[m].id] = true
      }
    }

    var vacanciesWithoutDocExame = 0
    for (var key in openVacancyIds) {
      if (!vacancyIdsWithDocExame[key]) {
        vacanciesWithoutDocExame++
      }
    }

    return e.json(200, {
      openVacancies: openVacancies,
      closedVacancies: closedVacancies,
      totalCandidates: totalCandidates,
      docExameCandidates: docExameCandidates,
      vacanciesWithoutDocExame: vacanciesWithoutDocExame,
    })
  },
  $apis.requireAuth(),
)
