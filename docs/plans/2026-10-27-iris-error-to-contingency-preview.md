# Plano: erro real da Íris ativa contingência manual no Preview

> Criado em 2026-10-27. Status: execução. Escopo autorizado: Preview apenas; sem Produção.

## Objetivo

Quando uma tentativa real de **Sugerir descrição com Íris** falhar por indisponibilidade do executor/modelo, interromper o falso estado verde, informar o RH com linguagem operacional, desabilitar nova tentativa automática e liberar imediatamente a revisão manual governada. A falha nunca cria rascunho, nunca publica vaga e nunca recebe autoridade do navegador.

## Decisão mínima

1. A falha real classificada como indisponibilidade é registrada pelo servidor confiado e produz estado operacional assinado `UNAVAILABLE`.
2. A resposta da tentativa inclui somente um código controlado; o frontend relê o estado operacional.
3. A tela mostra aviso: a Íris não pôde ser acionada e a Contingência Manual foi liberada.
4. `Sugerir descrição com Íris` fica desabilitado enquanto o estado for `UNAVAILABLE` ou `UNKNOWN`.
5. A Contingência Manual permite editar os três campos, mas o WordPress só recebe `draft` após confirmação humana e demais autorizações já existentes.
6. Um canário real posterior bem-sucedido pode restaurar `HEALTHY` e fechar a contingência.

## Sucesso

- [ ] Um teste backend prova que a primeira falha real gera estado assinado `UNAVAILABLE`, fresco e elegível, sem depender do navegador.
- [ ] Um teste backend prova que falhas de validação/conteúdo não são convertidas em indisponibilidade operacional.
- [ ] Um teste frontend prova que `UNAVAILABLE`/`UNKNOWN` desabilita o botão de sugestão.
- [ ] Um teste frontend prova que a falha mostra o aviso e relê o estado, revelando a contingência quando autorizada.
- [ ] Nenhum teste ou smoke cria rascunho automaticamente.
- [ ] Preview real demonstra erro → aviso → contingência manual; Produção permanece intocada.

## Tarefas

### Fase 1 — Contrato e RED

- [ ] Mapear o escritor assinado atual e o tratamento de erro no frontend.
- [ ] Adicionar regressões backend e frontend e observar falha pelo motivo esperado.

### Fase 2 — Implementação mínima

- [ ] Implementar transição assinada e serializada no servidor para falha real de disponibilidade.
- [ ] Reusar o endpoint de estado operacional no frontend após a falha.
- [ ] Desabilitar sugestão fora de `HEALTHY` e apresentar aviso operacional.

### Fase 3 — Verificação e Preview

- [ ] Rodar testes focados, suítes relevantes, build e verificação estática.
- [ ] Revisar autorização, escrita atômica, corrida com canário e ausência de mutação WordPress.
- [ ] Commitar/push com allowlist explícita e materializar somente no Preview.
- [ ] Validar no Edge compartilhado e ler de volta o estado/processo.

## Riscos e mitigação

- Corrida entre falha real e canário: usar o mesmo lock, sequência monotônica e assinatura canônica do produtor.
- Browser forjar indisponibilidade: a transição ocorre somente depois de falha real observada pelo Gateway.
- Falha de conteúdo ativar contingência indevidamente: classificar somente transporte, autenticação ou indisponibilidade do executor.
- Contingência publicar vaga: preservar `post_status=draft`, confirmação explícita e gate server-side.
- Preview tocar Produção: manter build e serviços separados; nenhuma promoção sem nova autorização.

## Estado atual

Causa do incidente reproduzida: o executor recebeu `401` por token OAuth expirado, enquanto o monitor ainda mostrava `HEALTHY` por último canário bem-sucedido. A falha real não alimentava o estado operacional e o frontend mantinha o botão ativo. Implementação autorizada somente no Preview.
