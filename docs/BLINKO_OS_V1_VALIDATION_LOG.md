# Blinko OS v1 — Log de validação

Data inicial: 09/09/2026  
Branch GitHub: `feat/blinko-os-v1-audit`  
PR: #25

Este log consolida os pacotes validados do Blinko OS v1. As simulações detalhadas permanecem como evidência principal de cada frente. Nenhuma migração experimental descrita abaixo deve ser interpretada como promovida automaticamente para `main`/produção.

## Pacote 01 — Tela Hoje

Status: **VALIDADO EM BUILD/PREVIEW**.

Implementado:
- fila server-only consolidando CRM + tarefas;
- contadores de vencidos/hoje/aguardando cliente;
- separação `Preciso fazer` x dependências;
- links contextuais.

## Pacote 02 — Estados operacionais de tarefa

Arquivo: `012_project_task_states.sql`.

Status: **VALIDADO EM AMBIENTE ISOLADO; NÃO PROMOVIDO**.

Guardas validados para `waiting_partner`, `blocked`, evidência de conclusão e auditoria.

## Pacotes 03–05 — Comercial, contrato e onboarding

Arquivos principais:
- `023_commercial_prediagnostic_sync.sql`;
- `024_commercial_audit_actor_type.sql`;
- `025_commercial_formalization_start_gate.sql`;
- `026_project_onboarding_readiness.sql`;
- `027_commercial_event_idempotency.sql`.

Status: **VALIDADO EM `blinko-os-v1-sim`; NÃO APLICADO À MAIN/PRODUÇÃO**.

Resultados:
- P01→P04 sincronizado com trilha de auditoria;
- classificação correta de atores `system`/`ai`/`human`;
- salto indevido P10→P13 reproduzido e corrigido;
- contrato válido + condições de início viraram gate real;
- P13 onboarding modular e P14 operação só após prontidão.

## Pacote 06 — Contatos + Empresa 360

Arquivos:
- `028_contacts_company_360.sql`;
- `029_contact_company_reuse.sql`.

Status: **VALIDADO EM `blinko-os-v1-sim`; NÃO PROMOVIDO**.

Resultados:
- Contato permanente separado de Lead;
- Empresa reaproveitada sem merge por nome;
- vínculo explícito Contato→Empresa;
- Empresa 360 com histórico operacional.

## Pacote 07 — Catálogo oficial S01–S40 + rotas R1–R6

Arquivos:
- `030_official_solution_catalog.sql`;
- `031_project_solution_lifecycle_alignment.sql`;
- `032_project_solution_gate_hardening.sql`;
- `033_project_solution_route_control.sql`.

Status: **VALIDADO EM `blinko-os-v1-sim`; NÃO PROMOVIDO**.

Resultados:
- 40/40 soluções oficiais;
- rota incompatível recusada;
- viabilidade e rota explícitas;
- onboarding por solução sem inventar rota histórica.

Detalhe: `docs/BLINKO_OS_V1_SIMULATION_008.md`.

## Pacote 08 — Change Requests

Arquivos:
- `034_project_change_requests.sql`;
- `035_change_request_analysis.sql`;
- `036_change_request_decision_immutability.sql`.

Status: **VALIDADO EM `blinko-os-v1-sim`; NÃO PROMOVIDO**.

Resultados:
- correção, revisão no escopo, mudança de escopo e nova demanda separados;
- análise de impacto antes da decisão;
- decisão humana imutável;
- nova demanda retorna ao Comercial.

Detalhe: `docs/BLINKO_OS_V1_SIMULATION_009_CHANGE_REQUEST.md`.

## Pacote 09 — Parceiros e compromissos financeiros

Arquivos:
- `037_partner_registry.sql`;
- `038_partner_financial_commitments.sql`;
- `039_partner_project_inheritance.sql`;
- `040_partner_payment_release.sql`.

Status: **VALIDADO EM `blinko-os-v1-sim`; NÃO PROMOVIDO**.

Resultados:
- cadastro/capacidade separado da solução;
- parceiro selecionado com evidência e rota;
- regra financeira por parceria;
- percentual de 50% da parceria gráfica armazenado sem cálculo automático enquanto a base estiver indefinida;
- herança ao projeto e gate de pagamento.

Detalhe: `docs/BLINKO_OS_V1_SIMULATION_010_PARTNERS.md`.

## Pacote 10 — Indicadores, metas e parâmetros financeiros

Arquivos:
- `041_indicators_targets_financial_settings.sql`;
- `042_commercial_estimate_for_forecast.sql`;
- `043_indicator_financial_coverage_guard.sql`.

Status: **VALIDADO EM `blinko-os-v1-sim`; NÃO PROMOVIDO**.

Resultados:
- indicadores financeiros, comerciais, operacionais, clientes e método;
- metas/parâmetros versionados;
- forecast baseado em estimativa explícita;
- cobertura financeira não é simulada quando a base é insuficiente.

Detalhes:
- `docs/BLINKO_OS_V1_SIMULATION_011_INDICATORS.md`;
- `docs/BLINKO_OS_V1_VALIDATION_011_SUMMARY.md`.

## Pacote 11 — Usuários, papéis e permissões

Arquivos:
- `044_internal_users_roles_permissions.sql`;
- `045_internal_session_revocation.sql`.

Status: **VALIDADO EM `blinko-os-v1-sim` + CI; NÃO PROMOVIDO**.

Resultados:
- usuários individuais;
- matriz V1 de papéis/permissões;
- menor privilégio;
- escopo por projeto;
- senha `scrypt` com salt individual;
- bootstrap compartilhado desativado após inicialização individual;
- `session_version` revoga sessões anteriores;
- proteções do último Admin/self-downgrade;
- dados financeiros protegidos por permissão.

Detalhe: `docs/BLINKO_OS_V1_SIMULATION_012_PERMISSIONS.md`.

## Pacote 12 — Configurações governadas e A01–A25

Arquivos:
- `046_versioned_settings_automation_templates.sql`;
- `047_automation_rule_idempotency_across_versions.sql`.

Status: **VALIDADO EM `blinko-os-v1-sim` + GitHub CI; NÃO PROMOVIDO**.

Resultados:
- parâmetros gerais versionados com evidência;
- catálogo A01–A25;
- regras de automação com estado separado de runtime binding;
- templates versionados apontando para Drive;
- log de execução idempotente;
- idempotência atravessa versões da mesma regra;
- `/interno/configuracoes` protegido por permissões administrativas.

Detalhe: `docs/BLINKO_OS_V1_SIMULATION_013_SETTINGS.md`.

Checkpoint funcional anterior `319c8f9359ab5eed5dba4b08a794bb216181ffa5`:
- GitHub Actions / Blinko CI #338: success;
- TypeScript: success;
- Next.js build: success;
- Vercel: não executou por `build-rate-limit`; não classificado como Preview validado.

## Pacote 13 — A23 Ciclos recorrentes + A24 Renovação + A25 Reavaliação

Arquivo:
- `048_recurring_cycles_renewal_reassessment.sql`.

Status de banco: **VALIDADO PONTA A PONTA EM `blinko-os-v1-sim`; NÃO PROMOVIDO**.

Fontes funcionais:
- Documento 06 — Operação e Qualidade;
- Documento 07 — Financeiro e Indicadores;
- Documento 08 — Sistema e Automação.

Resultados principais:
- contrato/projeto recorrente permanece estável;
- cada período possui `service_cycle` próprio;
- tarefas, aprovações, recebíveis e custos podem ser atribuídos ao ciclo;
- ciclo com tarefa aberta não fecha;
- pendência financeira exige nota de fechamento;
- carry-over exige justificativa;
- continuidade do ciclo e renovação contratual são decisões diferentes;
- próximo ciclo é bloqueado quando revisão de renovação é exigível e não foi resolvida;
- renovação gera nova oportunidade P01 reutilizando Lead, Contato e Empresa existentes;
- oportunidade original permanece P14/WON;
- reavaliação cria novo Diagnóstico com `assessment_cycle_number` e `previous_diagnostic_id`;
- diagnóstico anterior não é sobrescrito;
- reavaliação incluída no contrato não reabre nem altera a oportunidade comercial histórica.

Simulação 014:
- Ciclo 1: `fd1fc263-d887-4741-a535-8f59483845c1`, fechado;
- recebível atribuído ao ciclo: R$ 1.200,00;
- custo atribuído ao ciclo: R$ 300,00;
- Ciclo 2: `bf74b7f4-2b10-4a92-b503-15cf4ff3a9d7`, criado somente após renovação;
- review A24: `4c890ce3-3a65-47d4-b588-15c9caeb0461`;
- oportunidade de renovação: `b080309e-76a7-4d81-acd6-6c323559185d`;
- request A25: `bbf5c092-514d-489e-af9b-e107f89221a0`;
- novo Diagnóstico ciclo 2: `5d4079fe-541f-467a-a569-ece871b6d016`.

Interface implementada:
- menu `Recorrência`;
- `/interno/recorrencia`;
- `/interno/projetos/[id]/recorrencia`;
- A24/A25 incorporados à fila `Hoje` quando há ação real;
- criação de tarefa/aprovação/recebível/custo com `service_cycle_id`;
- nenhum cron automático ativado.

Hardening de acesso:
- ações de renovação `open/resolve` exigem `contracts.manage` no endpoint;
- leitura de contrato/renovação exige `contracts.view`;
- aprovação exige `approvals.view/manage`;
- diagnóstico/reavaliação exige `diagnostics.view/manage`;
- financeiro exige `finance.view/manage`;
- campos restritos são mascarados na camada server-side, não apenas escondidos visualmente.

Detalhe: `docs/BLINKO_OS_V1_SIMULATION_014_RECURRING_RENEWAL_REASSESSMENT.md`.

Validação de CI do HEAD final: **a registrar após conclusão do workflow do commit documental final**.

## Estado de segurança atual

- Neon `main`/produção permanece sem as migrações experimentais 028–048;
- GitHub `main` permanece sem promoção desta frente;
- DDL e fixtures foram testados somente em `blinko-os-v1-sim`;
- PR #25 permanece draft;
- nenhuma automação A23–A25 foi ativada como cron/runtime determinístico;
- ausência de parâmetro/data continua representada como `A DEFINIR`;
- promoção depende de plano explícito de bootstrap, sequência de migrações, smoke tests e rollback.

## Próxima frente

Com o núcleo funcional A01–A25 coberto, a próxima etapa é **plano controlado de promoção e rollback**, sem executar promoção automaticamente:
1. inventário e ordem de 012–048;
2. classificação de risco por migração;
3. pré-checks/backfills seguros;
4. bootstrap do primeiro Admin sem lockout;
5. smoke tests pós-migração;
6. rollback/forward-fix por pacote;
7. critérios de go/no-go para produção.
