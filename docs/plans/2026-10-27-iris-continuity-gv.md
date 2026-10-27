# Plano de continuidade da Íris no GV

**Objetivo:** impedir que uma indisponibilidade da autenticação ou do provedor da Íris paralise silenciosamente a criação de rascunhos de vagas, sem permitir publicação automática ou contornar a governança.

## Decisão de arquitetura

Adotar quatro camadas independentes:

1. **Prevenção:** renovação antecipada da autenticação dedicada da Íris.
2. **Detecção:** canário funcional sintético, sem persistência, usando o executor real da Íris.
3. **Continuidade governada:** contingência manual somente quando houver indisponibilidade funcional confirmada e recente.
4. **Transparência:** estado operacional e histórico traduzidos em linguagem de negócio no GV.

O futuro provedor secundário será acrescentado antes da contingência manual na cadeia de recuperação, sem alterar o contrato de segurança deste plano.

## Regras invariantes

- A rota normal continua exigindo prova assinada da sugestão da Íris.
- Falha isolada no navegador não abre contingência.
- Estado ausente, antigo, inválido ou desconhecido bloqueia a contingência.
- A contingência exige indisponibilidade confirmada por pelo menos dois canários e confirmação humana explícita.
- Somente usuário canônico, ativo e verificado de RH/admin pode operar.
- Somente requisição em `Aprovada` pode seguir.
- O destino é exclusivamente `draft`; nunca publicar automaticamente.
- Título, descrição pública e perfil interno são preservados e verificados por hash.
- Critérios protegidos/discriminatórios continuam bloqueados.
- O histórico registra origem manual, ator, janela, fingerprint e hashes; não registra novamente os textos.
- Nenhum segredo, hash, ID técnico, nome de provedor ou JSON bruto aparece na interface.
- A recuperação da Íris encerra imediatamente a autorização de contingência.

## Fase 1 — Contratos e interface no GV

### Arquivos

- `src/services/requisitions.ts`
- `src/pages/RequisitionDetail.tsx`
- `src/components/RequisitionHistory.tsx`
- `tests/requisitions-adapter.test.ts`
- novos testes de estado/contingência/histórico

### Entregas

- Consultar estado operacional autenticado.
- Exibir: Disponível, Atenção, Indisponível ou Estado não confirmado.
- Mostrar última verificação bem-sucedida sem detalhes técnicos.
- Não mostrar contingência em estado saudável, degradado ou desconhecido.
- Em indisponibilidade confirmada, oferecer fluxo manual separado com os três campos vazios ou preenchidos a partir dos dados atuais, revisão e confirmação explícita.
- Enviar a contingência diretamente ao backend governado; não fabricar `suggestion_proof`.
- Traduzir auditorias técnicas conhecidas no histórico e nunca renderizar JSON bruto.

## Fase 2 — Autoridade operacional e contingência no backend

### Componentes

- Gateway: canário funcional com payload sintético fixo e sem `suggestion_proof`.
- Monitor independente: execução periódica, classificação após duas falhas e emissão de atestado assinado.
- PocketBase: armazenamento/validação do atestado, status autenticado e rota manual independente.

### Estado operacional

- `HEALTHY`: canário real recente passou com `fallback=false`.
- `DEGRADED`: primeira falha ou latência excessiva; sem contingência.
- `UNAVAILABLE`: duas falhas consecutivas em pelo menos cinco minutos, evidência recente; contingência elegível.
- `UNKNOWN`: evidência ausente, antiga, inválida ou monitor indisponível; falha fechada.

Frequência inicial: a cada cinco minutos. Validade máxima do estado exibido: dez minutos.

### Rota manual

A rota manual:

1. relê ator e requisição no servidor;
2. valida o atestado `UNAVAILABLE` atual;
3. rejeita se houver recuperação posterior;
4. valida campos, HTML e critérios protegidos;
5. recalcula fingerprint e hashes;
6. serializa por requisição;
7. cria somente rascunho no WordPress;
8. verifica `post_status=draft` e hashes exatos;
9. persiste requisição e histórico atomicamente;
10. é idempotente e rejeita replay conflitante.

## Fase 3 — Proteção operacional

- Guard diário da credencial da Íris com antecedência maior que a do Nexo (96 horas).
- Lock, backup protegido, validação pós-renovação e substituição atômica.
- Canário funcional após cada renovação e periodicamente.
- Alerta privado imediato em falha de renovação, segunda falha de canário, estado desconhecido prolongado ou uso da contingência.
- Runbook de autenticação humana sem transporte de senha, 2FA, callback ou token pelo chat.

## Testes de aceitação

- A Íris saudável não mostra nem aceita contingência.
- Uma falha isolada não abre contingência.
- Duas falhas confirmadas abrem somente o fluxo manual.
- Estado antigo, inválido ou desconhecido bloqueia.
- Recuperação fecha a contingência.
- Usuário sem perfil de RH/admin é negado no servidor.
- Mudança na requisição ou nos textos após autorização é negada.
- WordPress sem prova de `draft` e hashes exatos é negado.
- Repetição idêntica é idempotente; repetição conflitante é negada.
- Canário não cria requisição, vaga, rascunho, histórico ou alteração de status.
- Histórico da interface não expõe JSON, fingerprints ou hashes.
- Build, lint, testes unitários e testes PocketBase 0.36 passam.

## Publicação

1. Implementar e testar em branch isolada baseada no último `origin/main` do SKIP.
2. Sincronizar a branch com GitHub sem sobrepor mudanças do SKIP.
3. Antes de qualquer Preview, confirmar com Lula que o Edge compartilhado do computador de casa está disponível.
4. Validar visualmente e funcionalmente no Preview, incluindo canário sem persistência e contingência sem publicação.
5. Lula decide a publicação em Produção; após publicação, verificar leitura real e auditoria.
