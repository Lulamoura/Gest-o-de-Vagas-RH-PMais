routerAdd(
  'GET',
  '/backend/v1/indicators/summary',
  (e) => {
    var query = e.requestInfo().query || {}
    var monthFilter = query.month || ''
    var periodStart = query.periodStart || ''
    var periodEnd = query.periodEnd || ''
    var clientId = query.clientId || ''
    var alertThreshold = parseInt(query.alertThreshold || '30', 10) || 30

    function parseDate(s) {
      if (!s) return null
      var d = new Date(String(s).replace(' ', 'T'))
      return isNaN(d) ? null : d
    }

    var dateStart = new Date('2000-01-01T00:00:00')
    var dateEnd = new Date('2100-12-31T23:59:59')

    if (periodStart && periodEnd) {
      dateStart = new Date(periodStart + 'T00:00:00')
      dateEnd = new Date(periodEnd + 'T23:59:59')
    } else if (monthFilter) {
      var parts = monthFilter.split('-')
      var yr = parseInt(parts[0], 10)
      var mo = parseInt(parts[1], 10)
      dateStart = new Date(yr, mo - 1, 1)
      dateEnd = new Date(yr, mo, 0, 23, 59, 59)
    }

    var vacancies = $app.findRecordsByFilter('vacancies', '', '-created', 0, 0)
    var candidates = $app.findRecordsByFilter('candidates', '', '-created', 0, 0)
    var clientes = $app.findRecordsByFilter('clientes', '', 'nome', 0, 0)

    var cargos = $app.findRecordsByFilter('cargos', '', 'created', 0, 0)
    var cargoMap = {}
    for (var i = 0; i < cargos.length; i++) cargoMap[cargos[i].id] = cargos[i].getString('nome')

    var clientesMap = {}
    for (var j = 0; j < clientes.length; j++)
      clientesMap[clientes[j].id] = clientes[j].getString('nome')

    var tiposVaga = $app.findRecordsByFilter('tipos_vaga', '', 'created', 0, 0)
    var tipoVagaMap = {}
    for (var k = 0; k < tiposVaga.length; k++)
      tipoVagaMap[tiposVaga[k].id] = tiposVaga[k].getString('nome')

    var tiposContrato = $app.findRecordsByFilter('tipos_contrato', '', 'created', 0, 0)
    var tipoContratoMap = {}
    for (var m = 0; m < tiposContrato.length; m++)
      tipoContratoMap[tiposContrato[m].id] = tiposContrato[m].getString('nome')

    var users = $app.findRecordsByFilter('users', '', 'created', 0, 0)
    var userMap = {}
    for (var u = 0; u < users.length; u++) userMap[users[u].id] = users[u].getString('name')

    var filteredVacancies = []
    for (var v = 0; v < vacancies.length; v++) {
      var vDateStr = vacancies[v].getString('data_abertura') || vacancies[v].getString('created')
      var vDate = parseDate(vDateStr)
      if (!vDate) continue
      if (vDate < dateStart || vDate > dateEnd) continue
      if (clientId && vacancies[v].getString('cliente') !== clientId) continue
      filteredVacancies.push(vacancies[v])
    }

    var filteredVacancyIds = {}
    for (var vi = 0; vi < filteredVacancies.length; vi++)
      filteredVacancyIds[filteredVacancies[vi].id] = true

    var filteredCandidates = []
    for (var c = 0; c < candidates.length; c++) {
      if (filteredVacancyIds[candidates[c].getString('vacancy_id')]) {
        filteredCandidates.push(candidates[c])
      }
    }

    var openVacancies = []
    var closedVacancies = []
    var concludedVacancies = []
    for (var ov = 0; ov < filteredVacancies.length; ov++) {
      var st = filteredVacancies[ov].getString('status_vaga')
      if (st === 'Concluída') {
        concludedVacancies.push(filteredVacancies[ov])
        closedVacancies.push(filteredVacancies[ov])
      } else if (st === 'Cancelada') {
        closedVacancies.push(filteredVacancies[ov])
      } else {
        openVacancies.push(filteredVacancies[ov])
      }
    }

    var avgClosingDays = 22
    if (concludedVacancies.length > 0) {
      var totalDays = 0
      for (var cd = 0; cd < concludedVacancies.length; cd++) {
        var dAb = parseDate(concludedVacancies[cd].getString('data_abertura'))
        var dFe = parseDate(concludedVacancies[cd].getString('data_fechamento'))
        if (!dAb || !dFe) continue
        var diff = Math.floor((dFe - dAb) / 86400000)
        if (diff < 0) diff = 0
        totalDays += diff
      }
      avgClosingDays = Math.round(totalDays / concludedVacancies.length)
    }

    var now = new Date()
    var delayedCount = 0
    for (var dv = 0; dv < openVacancies.length; dv++) {
      var dOpen = parseDate(openVacancies[dv].getString('data_abertura'))
      if (dOpen) {
        var daysOpen = Math.floor((now - dOpen) / 86400000)
        if (daysOpen > alertThreshold) delayedCount++
      }
    }

    var integrados = 0
    var totalCandidates = filteredCandidates.length
    var docExameCandidates = 0
    for (var ci = 0; ci < filteredCandidates.length; ci++) {
      var cSt = filteredCandidates[ci].getString('status_candidato')
      if (cSt === 'Integrado') integrados++
      if (cSt === 'Documentação e exame') docExameCandidates++
    }
    var taxa = totalCandidates > 0 ? (integrados / totalCandidates) * 100 : 0

    var totalRank = 0
    var rankedCount = 0
    for (var rc = 0; rc < filteredCandidates.length; rc++) {
      var rv = filteredCandidates[rc].getFloat('rank')
      if (rv > 0) {
        totalRank += rv
        rankedCount++
      }
    }
    var overallAvgRank = rankedCount > 0 ? Math.round((totalRank / rankedCount) * 10) / 10 : 0

    var candidatosEmProcesso = 0
    var candidatosIntegrados = 0
    for (var mi = 0; mi < filteredCandidates.length; mi++) {
      var cSt2 = filteredCandidates[mi].getString('status_candidato')
      if (cSt2 !== 'Desistente' && cSt2 !== 'Desclassificado' && cSt2 !== 'Em banco')
        candidatosEmProcesso++
      if (cSt2 === 'Integrado') candidatosIntegrados++
    }
    var totalPosicoes = 0
    for (var tp = 0; tp < openVacancies.length; tp++)
      totalPosicoes += openVacancies[tp].getFloat('quantidade_vagas')

    var statusCounts = {}
    for (var sc = 0; sc < filteredVacancies.length; sc++) {
      var sSt = filteredVacancies[sc].getString('status_vaga') || 'Sem status'
      statusCounts[sSt] = (statusCounts[sSt] || 0) + 1
    }
    var statusChart = []
    for (var sKey in statusCounts) statusChart.push({ name: sKey, value: statusCounts[sKey] })

    var phaseMap = {
      'Análise do RH': 'Triagem',
      'Análise do gestor': 'Entrevistas',
      'Documentação e exame': 'Pré-Aprovação',
      'Cadastro DP': 'Contratação',
      Integrado: 'Fechada',
    }
    var phaseCounts = { Triagem: 0, Entrevistas: 0, 'Pré-Aprovação': 0, Contratação: 0, Fechada: 0 }
    for (var pc = 0; pc < filteredCandidates.length; pc++) {
      var ph = phaseMap[filteredCandidates[pc].getString('status_candidato')]
      if (ph) phaseCounts[ph]++
    }
    var phaseOrder = ['Triagem', 'Entrevistas', 'Pré-Aprovação', 'Contratação', 'Fechada']
    var candidatesPerPhase = []
    for (var po = 0; po < phaseOrder.length; po++)
      candidatesPerPhase.push({ fase: phaseOrder[po], total: phaseCounts[phaseOrder[po]] })

    var typeCounts = {}
    for (var vt = 0; vt < openVacancies.length; vt++) {
      var tId = openVacancies[vt].getString('tipo_vaga')
      var tNome = tId ? tipoVagaMap[tId] || 'Sem tipo' : 'Sem tipo'
      typeCounts[tNome] = (typeCounts[tNome] || 0) + 1
    }
    var vacanciesByType = []
    for (var tKey in typeCounts) vacanciesByType.push({ name: tKey, value: typeCounts[tKey] })

    var vacancyRankMap = {}
    for (var rvi = 0; rvi < filteredCandidates.length; rvi++) {
      var cRank = filteredCandidates[rvi].getFloat('rank')
      if (cRank <= 0) continue
      var rVId = filteredCandidates[rvi].getString('vacancy_id')
      if (!vacancyRankMap[rVId]) {
        var rVac = null
        for (var rvf = 0; rvf < filteredVacancies.length; rvf++) {
          if (filteredVacancies[rvf].id === rVId) {
            rVac = filteredVacancies[rvf]
            break
          }
        }
        vacancyRankMap[rVId] = {
          avg: 0,
          count: 0,
          cargo: rVac ? cargoMap[rVac.getString('cargo')] || '—' : '—',
          cliente: rVac ? clientesMap[rVac.getString('cliente')] || '—' : '—',
          contrato: rVac ? tipoContratoMap[rVac.getString('tipo_contrato')] || '—' : '—',
        }
      }
      vacancyRankMap[rVId].avg += cRank
      vacancyRankMap[rVId].count += 1
    }
    var rankingPerVacancy = []
    for (var rKey in vacancyRankMap) {
      rankingPerVacancy.push({
        vId: rKey,
        cargo: vacancyRankMap[rKey].cargo,
        cliente: vacancyRankMap[rKey].cliente,
        contrato: vacancyRankMap[rKey].contrato,
        avgRank: Math.round((vacancyRankMap[rKey].avg / vacancyRankMap[rKey].count) * 10) / 10,
        count: vacancyRankMap[rKey].count,
      })
    }
    rankingPerVacancy.sort(function (a, b) {
      return b.avgRank - a.avgRank
    })

    var stalled = []
    for (var sv = 0; sv < openVacancies.length; sv++) {
      var sVac = openVacancies[sv]
      var sAb = parseDate(sVac.getString('data_abertura'))
      var sDays = sAb ? Math.floor((now - sAb) / 86400000) : 0
      stalled.push({
        id: sVac.id,
        cargo: cargoMap[sVac.getString('cargo')] || '—',
        cliente: clientesMap[sVac.getString('cliente')] || '—',
        contrato: tipoContratoMap[sVac.getString('tipo_contrato')] || '—',
        diasParado: sDays,
        responsavelRh: userMap[sVac.getString('responsavel_rh')] || '',
        dataAbertura: sVac.getString('data_abertura') || '',
        prazoDesejado: sVac.getString('prazo_desejado') || '',
      })
    }
    stalled.sort(function (a, b) {
      return b.diasParado - a.diasParado
    })
    stalled = stalled.slice(0, 5)

    var totalConsultas = 0,
      totalExames = 0,
      totalTestes = 0,
      totalExtras = 0
    for (var cc = 0; cc < filteredCandidates.length; cc++) {
      totalConsultas += filteredCandidates[cc].getFloat('custo_consultas')
      totalExames += filteredCandidates[cc].getFloat('custo_exames')
      totalTestes += filteredCandidates[cc].getFloat('custo_testes')
      totalExtras += filteredCandidates[cc].getFloat('custo_extras')
    }
    var despesasVaga = 0
    for (var dve = 0; dve < filteredVacancies.length; dve++)
      despesasVaga += filteredVacancies[dve].getFloat('despesas_vaga')
    var totalCost = totalConsultas + totalExames + totalTestes + totalExtras + despesasVaga

    var vacancyIdsWithDocExame = {}
    for (var wd = 0; wd < filteredCandidates.length; wd++) {
      if (filteredCandidates[wd].getString('status_candidato') === 'Documentação e exame') {
        vacancyIdsWithDocExame[filteredCandidates[wd].getString('vacancy_id')] = true
      }
    }
    var openVacancyIds = {}
    for (var oi = 0; oi < openVacancies.length; oi++) openVacancyIds[openVacancies[oi].id] = true
    var vacanciesWithoutDocExame = 0
    for (var wkey in openVacancyIds) {
      if (!vacancyIdsWithDocExame[wkey]) vacanciesWithoutDocExame++
    }

    var clientesList = []
    for (var cl = 0; cl < clientes.length; cl++)
      clientesList.push({ id: clientes[cl].id, nome: clientes[cl].getString('nome') })

    var candidatesTypeVagaCounts = {}
    for (var ctv = 0; ctv < filteredCandidates.length; ctv++) {
      if (filteredCandidates[ctv].getString('status_candidato') !== 'Integrado') continue
      var tvId = filteredCandidates[ctv].getString('tipo_vaga')
      var tvNome = tvId ? tipoVagaMap[tvId] || 'Sem tipo' : 'Sem tipo'
      candidatesTypeVagaCounts[tvNome] = (candidatesTypeVagaCounts[tvNome] || 0) + 1
    }
    var candidatesByTypeVaga = []
    for (var ctvKey in candidatesTypeVagaCounts)
      candidatesByTypeVaga.push({ name: ctvKey, value: candidatesTypeVagaCounts[ctvKey] })

    var candidatesTypeContratoCounts = {}
    for (var ctc = 0; ctc < filteredCandidates.length; ctc++) {
      if (filteredCandidates[ctc].getString('status_candidato') !== 'Integrado') continue
      var tcId = filteredCandidates[ctc].getString('tipo_contrato')
      var tcNome = tcId ? tipoContratoMap[tcId] || 'Sem tipo' : 'Sem tipo'
      candidatesTypeContratoCounts[tcNome] = (candidatesTypeContratoCounts[tcNome] || 0) + 1
    }
    var candidatesByTypeContrato = []
    for (var ctcKey in candidatesTypeContratoCounts)
      candidatesByTypeContrato.push({ name: ctcKey, value: candidatesTypeContratoCounts[ctcKey] })

    return e.json(200, {
      openVacancies: openVacancies.length,
      closedVacancies: closedVacancies.length,
      totalCandidates: totalCandidates,
      docExameCandidates: docExameCandidates,
      vacanciesWithoutDocExame: vacanciesWithoutDocExame,
      closedVacanciesMonth: concludedVacancies.length,
      averageClosingDays: avgClosingDays,
      delayedVacancies: delayedCount,
      conversionRate: { integrados: integrados, total: totalCandidates, taxa: taxa },
      overallAverageRank: overallAvgRank,
      mandatoryIndicator: {
        candidatosEmProcesso: candidatosEmProcesso,
        totalPosicoes: totalPosicoes,
        candidatosIntegrados: candidatosIntegrados,
      },
      statusChart: statusChart,
      candidatesPerPhase: candidatesPerPhase,
      vacanciesByType: vacanciesByType,
      candidatesByTypeVaga: candidatesByTypeVaga,
      candidatesByTypeContrato: candidatesByTypeContrato,
      rankingPerVacancy: rankingPerVacancy,
      stalledVacancies: stalled,
      totalAccumulatedCost: totalCost,
      costBreakdown: {
        consultas: totalConsultas,
        exames: totalExames,
        testes: totalTestes,
        extras: totalExtras,
        despesasVaga: despesasVaga,
      },
      totalFilteredCandidates: totalCandidates,
      clientes: clientesList,
    })
  },
  $apis.requireAuth(),
)
