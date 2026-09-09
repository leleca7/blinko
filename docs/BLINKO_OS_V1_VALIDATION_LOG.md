# Blinko OS v1 — Log de validação

Data: 09/09/2026
Branch GitHub: `feat/blinko-os-v1-audit`
PR: #25

## Pacote 01 — Tela Hoje

Status: **VALIDADO EM BUILD/PREVIEW**

Alterações:
- fila server-only consolidando CRM + tarefas de projetos;
- contadores de tarefas vencidas, tarefas com prazo hoje e tarefas aguardando cliente;
- separação visual entre `Preciso fazer` e `Aguardando cliente`;
- links contextuais para pré-diagnóstico ou projeto.

Validação:
- GitHub Actions / Blinko CI: success;
- Vercel Preview: READY;
- nenhuma alteração no banco principal.

## Pacote 02 — Estados operacionais de tarefa

Arquivo: `neon/sql/012_project_task_states.sql`

Status: **SCHEMA E REGRAS VALIDADOS EM BRANCH TEMPORÁRIA; NÃO APLICADO À MAIN**

Estrutura testada:
- `dependency_note`;
- `blocking_reason`;
- `blocking_owner_label`;
- `blocking_impact`;
- `next_check_at`;
- `completed_at`;
- status `waiting_partner`;
- status `blocked`.

Regras testadas com tarefa fictícia:

1. `waiting_partner` sem descrição da dependência → **RECUSADO**, como esperado.
2. `waiting_partner` com dependência + próxima checagem → **ACEITO**.
3. `blocked` sem responsável pelo desbloqueio → **RECUSADO**, como esperado.
4. `blocked` com motivo + responsável + impacto + próxima checagem → **ACEITO**.
5. `done` sem evidência de conclusão → **RECUSADO**, como esperado.
6. `done` com evidência → **ACEITO**, com `completed_at` registrado.
7. Mudanças válidas geram evento em `audit_events`.

A branch temporária usada pelo fluxo de migração foi descartada sem aplicar alterações na `main`.

## Ambiente permanente de simulação

Branch Neon criada: `blinko-os-v1-sim`

Objetivo:
- receber empresas fictícias;
- testar fluxo ponta a ponta;
- permitir evolução de schema sem misturar dados com produção.

Observação: o conector Vercel disponível nesta sessão não oferece escrita de variáveis de ambiente. Portanto, o Preview ainda não foi apontado automaticamente para a `DATABASE_URL` desta branch. Não expor connection strings em código, commits ou chat.

## Próxima validação

1. Aplicar a migração 012 apenas no ambiente de simulação, mediante autorização para DDL nessa branch.
2. Implementar controles de estado da tarefa na interface.
3. Evoluir `Hoje` para os quatro grupos oficiais:
   - Preciso fazer;
   - Aguardando cliente;
   - Aguardando parceiro;
   - Bloqueado.
4. Criar Cliente Fictício 001 e executar fluxo operacional completo.
