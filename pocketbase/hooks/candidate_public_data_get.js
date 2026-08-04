routerAdd('GET', '/backend/v1/candidate-public-data/{id}', (e) => {
  const id = e.request.pathValue('id')
  if (!id) return e.badRequestError('ID é obrigatório')

  let candidate
  try {
    candidate = $app.findRecordById('candidates', id)
  } catch (_) {
    return e.notFoundError('Candidato não encontrado')
  }

  let vacancyTitle = ''
  try {
    const vacancy = $app.findRecordById('vacancies', candidate.getString('vacancy_id'))
    const cargoId = vacancy.getString('cargo')
    if (cargoId) {
      const cargo = $app.findRecordById('cargos', cargoId)
      vacancyTitle = cargo.getString('nome')
    }
  } catch (_) {}

  const vtq = candidate.get('vale_transporte_qtd')
  const vut = candidate.get('valor_unitario_transporte')
  const dn = candidate.getString('data_nascimento')

  return e.json(200, {
    nome: candidate.getString('nome'),
    email: candidate.getString('email'),
    vacancy_title: vacancyTitle,
    rg: candidate.getString('rg'),
    tamanho_fardamento: candidate.getString('tamanho_fardamento'),
    tamanho_sapato: candidate.getString('tamanho_sapato'),
    vale_transporte_qtd: vtq ? Number(vtq) : 0,
    nome_pai: candidate.getString('nome_pai'),
    nome_mae: candidate.getString('nome_mae'),
    telefone_emergencia: candidate.getString('telefone_emergencia'),
    data_nascimento: dn ? dn.split(' ')[0] : '',
    valor_unitario_transporte: vut ? Number(vut) : 0,
  })
})
