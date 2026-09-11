# Blinko OS v1 — Simulação 014 — Recorrência, renovação e reavaliação

Data: 10/09/2026  
Ambiente: `blinko-os-v1-sim`  
Migração: `048_recurring_cycles_renewal_reassessment.sql`  
Produção/main: **não alteradas**

## Objetivo

Validar A23, A24 e A25 sem transformar um serviço recorrente em projeto infinito, sem criar Empresa/Contato/Lead duplicados e sem sobrescrever diagnóstico histórico.

Fontes funcionais usadas:
- Documento 06 — Operação e Qualidade: ciclo de serviço recorrente como entidade própria, fechamento por período, carry-over justificado e continuidade contratual preservada;
- Documento 07 — Financeiro e Indicadores: receita/custo atribuíveis ao projeto/ciclo e ausência de parâmetro tratada como `A DEFINIR`;
- Documento 08 — Sistema e Automação: A23 ciclo recorrente, A24 renovação e A25 reavaliação diagnóstica.

## Estrutura implementada

A migração 048 adicionou:
- `recurring_service_plans` versionado por projeto;
- `service_cycles` com sequência, período, entregáveis, pendências, evidência de fechamento, indicadores, carry-over e decisão de continuidade;
- `service_cycle_id` opcional em tarefas, aprovações, recebíveis e custos de projeto;
- `contract_renewal_reviews` para A24;
- `diagnostic_reassessment_requests` e lineage em `diagnostics` para A25;
- views `recurring_service_cycle_summary`, `recurring_renewal_queue` e `diagnostic_reassessment_queue`;
- proteção em `commercial_sync_from_diagnostic()` para que uma reavaliação incluída no contrato não altere a oportunidade comercial histórica.

## A23 — Ciclos recorrentes

Projeto-base reutilizado: `2cfb0973-50df-4bac-92cc-070f957a343f`  
Empresa reutilizada: `d1ed6ba4-4f20-4e82-8206-2acae85437bb`  
Contrato válido: `c0252f55-150d-4295-8936-fcfaed616372`

Plano recorrente:
- ID `3fd039da-3183-4319-98ec-2794411948bd`;
- mensal;
- primeiro período 01/09/2026–30/09/2026;
- validade contratual até 30/11/2026;
- revisão de renovação explicitamente configurada para 01/10/2026;
- nenhum prazo foi inferido pelo sistema.

### Testes negativos

1. Plano ativo em projeto legado sem contrato válido → **RECUSADO**.
2. Plano recorrente sem evidência → **RECUSADO**.
3. Fechar ciclo com tarefa aberta → **RECUSADO** com `service cycle has open tasks`.
4. Fechar ciclo com recebível/custo em aberto e sem nota financeira → **RECUSADO**.
5. Fechar ciclo com carry-over sem justificativa → **RECUSADO**.
6. Criar Ciclo 2 quando a revisão de renovação já é exigível e ainda não foi resolvida → **RECUSADO**.

### Ciclo 1

ID: `fd1fc263-d887-4741-a535-8f59483845c1`  
Período: 01/09/2026–30/09/2026  
Status final: `closed`  
Continuidade: `approved`

Tarefa vinculada ao ciclo:
- `ad7d912b-0c1d-42ff-989a-853535a1e597`;
- concluída com evidência `SIM014-EVIDENCIA-TAREFA-1`.

Financeiro atribuível ao ciclo:
- recebível previsto: **R$ 1.200,00**;
- custo comprometido: **R$ 300,00**;
- ambos permaneceram rastreados mesmo após o fechamento operacional do ciclo.

Carry-over:
- item: `SIM014 ajustar cadência de revisão no próximo período`;
- justificativa obrigatória registrada;
- item reapareceu como `pending_items` no Ciclo 2.

### Ciclo 2

ID: `bf74b7f4-2b10-4a92-b503-15cf4ff3a9d7`  
Período: 01/10/2026–31/10/2026  
Status: `planned`  
`previous_cycle_id` aponta para o Ciclo 1.

O Ciclo 2 só nasceu depois da decisão de renovação descrita abaixo.

## A24 — Renovação

Review: `4c890ce3-3a65-47d4-b588-15c9caeb0461`

Validações:
1. criação do próximo ciclo antes da revisão devida → **BLOQUEADA**;
2. resolução da renovação sem evidência → **BLOQUEADA**;
3. decisão humana `renew` registrada com evidência `SIM014-EVIDENCIA-DECISAO-RENOVAR`;
4. renovação encaminhada ao Comercial como **nova Oportunidade P01**.

Nova oportunidade de renovação: `b080309e-76a7-4d81-acd6-6c323559185d`.

A nova oportunidade reutilizou exatamente:
- Lead `1d1c9d2a-f14d-4fa2-b5f0-6d869c22383a`;
- Contato `ce28acf5-f3a0-4e0e-9a69-371afe66de40`;
- Empresa `d1ed6ba4-4f20-4e82-8206-2acae85437bb`.

A oportunidade comercial de origem permaneceu `P14/WON`; a renovação não reabriu nem deformou a venda histórica.

## A25 — Reavaliação diagnóstica

O Diagnóstico da Simulação 008 foi inicialmente inspecionado, mas estava `ready_for_presentation`; por isso ele **não foi usado** como base e nenhum gate foi contornado.

Foi utilizado o projeto ativo da Simulação 004:
- Projeto `35cd784b-0c52-4ab6-b6f2-0c60e540a7af`;
- Diagnóstico-base `29d26c8e-21a7-4d39-acd9-e44e7c76f0c3`;
- status do diagnóstico-base: `completed`;
- ciclo diagnóstico: 1;
- oportunidade original `ce7037dd-f2a1-4a44-84f2-16826881b43a`, `P14/WON`.

Request de reavaliação: `bbf5c092-514d-489e-af9b-e107f89221a0`.

Validações:
1. marcar a rota como `included_in_contract` sem evidência → **RECUSADO**;
2. rota contratual registrada com evidência humana;
3. novo Diagnóstico criado: `5d4079fe-541f-467a-a569-ece871b6d016`;
4. novo Diagnóstico iniciou em `collection`;
5. `assessment_cycle_number=2`;
6. `previous_diagnostic_id` aponta para o diagnóstico-base;
7. o diagnóstico-base permaneceu `completed`, ciclo 1, sem ser sobrescrito;
8. a oportunidade antiga continuou `P14/WON`, com o mesmo `diagnostic_id` e sem atualização colateral.

Essa validação comprova que reavaliar significa **criar uma nova observação temporal da mesma Empresa**, e não editar o diagnóstico anterior.

## Auditoria

A trilha registrou como `actor_type=human`:
- `service_cycle_created`;
- `service_cycle_started`;
- `service_cycle_closed`;
- `renewal_review_opened`;
- `renewal_routed_to_commercial`;
- `renewal_review_resolved`;
- `service_cycle_created_from_previous`;
- `diagnostic_reassessment_scheduled`;
- `diagnostic_reassessment_route_decided`;
- `diagnostic_reassessment_started`.

## Interface

Implementado no branch de trabalho:
- menu global `Recorrência`;
- `/interno/recorrencia` com visão de projetos/ciclos e pendências autorizadas;
- `/interno/projetos/[id]/recorrencia` com Plano Recorrente, Ciclos, Renovação e Reavaliação;
- criação de tarefa, aprovação, recebível e custo já vinculados ao ciclo;
- A24/A25 integrados à tela `Hoje` quando existe ação real;
- nenhum cron automático foi ativado.

### Menor privilégio

A interface e a camada server-side respeitam domínio e escopo:
- projeto: `projects.view/manage`;
- tarefas: `tasks.manage`;
- aprovação: `approvals.view/manage`;
- financeiro: `finance.view/manage`;
- renovação/contrato: `contracts.view/manage`;
- Comercial: `commercial.manage`;
- reavaliação: `diagnostics.view/manage`.

`renewal_open` e `renewal_resolve` exigem `contracts.manage` no backend, e não apenas na visibilidade do formulário. Campos financeiros, contratuais, de aprovação e diagnóstico são filtrados server-side quando a sessão não possui a permissão correspondente.

## Conclusão

A23–A25 ficaram modelados de forma manual-first e auditável:
- serviço recorrente não vira projeto infinito;
- ciclo não avança com pendência estrutural escondida;
- renovação não usa prazo inventado e não duplica entidades permanentes;
- reavaliação preserva diagnóstico anterior;
- automação futura pode usar essas entidades, mas nenhum cron/regra determinística nova foi habilitado neste pacote.

Neon `main`/produção e GitHub `main` permanecem intocados. PR #25 permanece draft.
