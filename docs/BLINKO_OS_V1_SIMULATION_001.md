# Blinko OS v1 — Simulação 001

Data: 09/09/2026
Ambiente: Neon `blinko-os-v1-sim`
Código: `feat/blinko-os-v1-audit`

## Cenário

Empresa inteiramente fictícia: **Ateliê Horizonte Móveis — SIMULAÇÃO 001**.

Objetivo da simulação: validar o fluxo operacional real do Blinko OS sem usar dados de cliente e sem alterar o banco de produção.

## Entrada criada pelo fluxo oficial

- contato fictício: Marina Teste;
- segmento: móveis planejados e marcenaria;
- localidade: Salvador/BA;
- score comercial: 9/10;
- prioridade: alta;
- origem: `blinko_os_simulation`;
- problema percebido: ausência de CRM, follow-up manual, marca inconsistente, arquivos dispersos e financeiro fragmentado.

A entrada foi criada por `create_pre_diagnostic_submission`, gerando automaticamente lead, pré-diagnóstico, ação CRM e evento de auditoria.

## Decisão humana

Rota aprovada: **Diagnóstico Blinko Completo**.

Justificativa: os sintomas atingem simultaneamente Comercial, Marca, Operação, Financeiro e Tecnologia. Tratar apenas um serviço isolado teria alto risco de atacar sintomas e não causas.

A decisão foi registrada por `record_pre_diagnostic_review` sem dependência de IA.

## Leitura inicial

Foi criada, aprovada e marcada como enviada uma leitura inicial por canal de simulação. Nenhuma mensagem real foi enviada.

Identificador externo fictício: `SIM-001-LEITURA-INICIAL`.

## Diagnóstico

O Diagnóstico Blinko foi ofertado no ambiente de simulação e recebeu confirmação de pagamento fictícia:

`SIM-001-PAGAMENTO-FICTICIO`

Resultado esperado e confirmado:

- lead: `diagnostic_paid`;
- empresa criada no cadastro principal;
- diagnóstico: `collection`;
- nova ação: `diagnostic_collection`;
- nenhuma cobrança real realizada.

## Migração 012

A migração `012_project_task_states.sql` foi aplicada somente em `blinko-os-v1-sim`.

O schema de produção permaneceu inalterado. A comparação com a branch principal mostra apenas:

- novos campos de dependência/bloqueio/conclusão em `project_tasks`;
- novos estados `waiting_partner` e `blocked`;
- índice `project_tasks_next_check_idx`;
- função auditada `update_project_task_state`.

## Defeito encontrado pela simulação

### Ações CRM concluídas permanecem `pending`

Após a revisão humana e a aprovação/envio da leitura inicial, as ações abaixo permaneceram abertas no banco:

- `review_pre_diagnostic`;
- `review_initial_reading`.

A interface atual evita exibi-las por filtros de consistência, mas isso apenas mascara o problema. O correto é encerrar a ação no momento em que o fato de negócio correspondente é concluído.

Correção necessária:

1. `record_pre_diagnostic_review` deve concluir a ação `review_pre_diagnostic` relacionada;
2. `approve_pre_diagnostic_initial_reading` deve concluir a ação `review_initial_reading` relacionada;
3. ambas as transições devem preservar auditoria e idempotência.

## Próxima etapa da simulação

Executar a coleta do Diagnóstico Blinko do Cliente Fictício 001 e testar:

1. dados e evidências;
2. pilares;
3. análise manual sem IA paga;
4. problemas e causas;
5. prioridades;
6. intervenções;
7. proposta;
8. contratação fictícia;
9. onboarding;
10. projeto e tarefas com os quatro estados operacionais.
