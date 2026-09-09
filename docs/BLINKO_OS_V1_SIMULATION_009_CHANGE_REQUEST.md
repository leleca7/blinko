# Blinko OS v1 — Simulação 009 — Change Request

Data: 09/09/2026
Branch GitHub: `feat/blinko-os-v1-audit`
PR: #25
Ambiente Neon: `blinko-os-v1-sim`

## Objetivo

Validar a regra oficial do Documento 06 — Operação e Qualidade para alterações durante a execução:

1. correção de erro;
2. revisão dentro do escopo;
3. mudança de escopo;
4. nova demanda.

Regra central: **classificar antes de executar**.

Produção/main não recebeu estas migrações.

## Migrações

- `034_project_change_requests.sql`
- `035_change_request_analysis.sql`
- `036_change_request_decision_immutability.sql`

## Estrutura criada

Entidade `project_change_requests` com:

- Projeto e solução relacionada;
- solicitante e data;
- descrição e classificação;
- entregável/versão afetados;
- referência de escopo;
- análise de impacto;
- impacto em prazo e nova data quando confirmado;
- impacto financeiro e referência quando confirmado;
- responsável pela decisão;
- decisão, evidência e histórico;
- consumo/numeração de revisão;
- nova Oportunidade quando for nova demanda;
- tarefas vinculadas;
- evidência de implementação e encerramento.

A decisão também possui histórico próprio em `project_change_request_decisions`.

## Regras de proteção

- Tarefa de alteração não entra em execução antes de aprovação humana.
- Correção de erro não consome revisão do cliente.
- Revisão dentro do escopo, quando aprovada, recebe sequência de rodada.
- Nenhum limite de revisões foi inventado; o sistema apenas registra consumo/ordem até existir regra contratual estruturada.
- Mudança de escopo exige análise de impacto antes de aprovação.
- Mudança de escopo com impacto confirmado em prazo exige nova data proposta.
- Mudança de escopo com impacto financeiro confirmado exige referência financeira rastreável.
- A referência financeira não cria preço, margem ou regra automática.
- Nova demanda não pode ser aprovada nem executada como tarefa escondida no Projeto atual.
- Nova demanda é roteada para nova Oportunidade P01, preservando Empresa e Contato.
- Depois de uma decisão sair de `pending`, ela é imutável; nova situação exige novo Change Request.
- A classificação é imutável; reclassificação exige cancelar e abrir novo registro.

## Cenário utilizado

Projeto da Simulação 008:
`2cfb0973-50df-4bac-92cc-070f957a343f`

Empresa:
`Ateliê Horizonte Móveis — SIMULAÇÃO 001`

Solução:
`S10 — Implantação / Organização de CRM`

### Caso A — Correção de erro

Change Request:
`21848858-9483-4d7c-9d0d-07663447b989`

Teste:
- correção criada;
- tentativa de criar tarefa antes da decisão → **RECUSADA**;
- decisão humana → aprovada;
- `consumes_revision=false`;
- `revision_sequence=null`;
- tarefa vinculada criada;
- tarefa concluída com evidência;
- Change Request encerrado com evidência.

Resultado: **correção concluída sem consumir revisão do cliente**.

### Caso B — Revisão dentro do escopo

Change Request:
`b5524b4c-e21a-4014-8986-df519ef9266b`

Teste:
- refinamento sem mudança de objetivo/entregável/direção;
- aprovação humana;
- `consumes_revision=true`;
- `revision_sequence=1`;
- tarefa concluída com evidência;
- Change Request encerrado.

Resultado: **Revisão #1 registrada sem presumir quantidade máxima contratada**.

### Caso C — Mudança de escopo

Change Request:
`95c76669-9ea2-46f9-a0ee-d7e110516a5b`

Demanda fictícia: adicionar uma segunda automação e novos campos fora da proposta original.

Teste:
- solicitação criada inicialmente sem análise concluída;
- tentativa de aprovação → **RECUSADA** com `scope change requires impact analysis before approval`;
- análise de impacto atualizada de forma auditável;
- impacto em prazo marcado como confirmado com nova data proposta;
- impacto financeiro marcado como confirmado com referência `REF-FIN-SIM009-SEM-REGRA-DE-PRECO`;
- aprovação humana com evidência;
- tarefa de execução criada;
- Change Request permaneceu `in_execution`.

Resultado: **mudança de escopo não entra em execução sem análise e decisão**.

### Caso D — Nova demanda

Change Request:
`ed177d65-6b4a-42e3-87ba-07631c7743e6`

Demanda fictícia: dashboard de vendas independente da implantação de CRM.

Teste:
- tentativa de aprovar dentro do projeto → **RECUSADA**;
- tentativa de criar tarefa no projeto → **RECUSADA**;
- roteamento comercial estratégico executado;
- nova Oportunidade criada: `c2f9367b-3723-4305-9268-90dbe4f3611e`;
- etapa inicial: P01;
- mesma Empresa, Contato e Lead de origem;
- `source=project_change_request`;
- próxima ação própria: `Qualificar nova demanda originada do projeto`.

Resultado: **nova demanda não contamina o escopo atual e volta ao fluxo comercial**.

## Imutabilidade da decisão

Após a mudança de escopo estar aprovada e em execução, foi feita tentativa de reverter a decisão para rejeitada.

Resultado: **RECUSADO** pelo banco com:

`change request decision is immutable after human decision; create a new request for a new situation`

Isso impede reescrita silenciosa do histórico.

## Integração com Hoje

Foi criado um fixture temporário pendente:
`ffc9d8fe-d0af-4159-9e05-6ef5da2b6bd7`

A consulta operacional o identificou como:

- Empresa: Ateliê Horizonte Móveis — SIMULAÇÃO 001;
- classificação: correção de erro;
- decisão: pending;
- ação de Hoje: `Decidir correção operacional`.

Depois do teste, o fixture foi cancelado de forma auditável.

A interface `Hoje` agora recebe também ações `change_request` e direciona para `/interno/projetos/[id]/alteracoes`.

## Interfaces implementadas

- `/interno/alteracoes` — visão global de alterações e decisões pendentes;
- `/interno/projetos/[id]/alteracoes` — Central de Alterações do Projeto;
- navegação interna com item `Alterações`;
- formulário de nova solicitação;
- análise de impacto;
- decisão humana;
- vínculo com aprovação já registrada ou evidência rastreável;
- roteamento de nova demanda para Comercial;
- criação de tarefa após aprovação;
- encerramento com evidência;
- histórico de decisões;
- integração com a fila `Hoje`.

## Estado de validação

HEAD funcional anterior à documentação:
`7df9312dce5db5d2927dcbd01edf98e0f0f58126`

- GitHub CI: **success**;
- Vercel Preview: **success / Deployment has completed**.

## Segurança

- Migrações 034–036 aplicadas somente em `blinko-os-v1-sim`.
- Neon main/produção não foi alterado.
- PR #25 permanece draft.
- Nenhum preço, margem ou percentual de parceiro foi criado automaticamente.

## Próximo ponto de continuidade

Próximo pacote oficial: **Parceiros + regras validadas de custo/repasse**.

Antes de implementar:
1. ler Documento 07 — Financeiro e Indicadores como autoridade de preço/custo/margem/repasse;
2. reaproveitar o cadastro de parceiros que já existir no schema, se houver;
3. estruturar status e validação de parceiro sem transformar Hélio ou a parceira audiovisual em parceiro ativo antes das pendências oficiais;
4. nunca assumir percentual fixo de divisão/repasse sem regra validada e versionada.
