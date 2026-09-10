# Blinko OS v1 — Log de validação

Data-base: 10/09/2026
Branch GitHub: `feat/blinko-os-v1-audit`
PR: #25
Ambiente de schema/testes: `blinko-os-v1-sim`
Produção/main: **NÃO ALTERADOS**

Este log consolida o estado validado da evolução do Blinko OS v1. Os documentos de simulação específicos permanecem como evidência detalhada dos cenários.

## Pacote 01 — Tela Hoje

Status: **VALIDADO EM BUILD/PREVIEW**.

- fila operacional consolidada;
- separação `Preciso fazer`, `Aguardando cliente`, `Aguardando parceiro` e `Bloqueado`;
- CRM, projetos, aprovações, financeiro, encerramento, Change Requests e próximas ações comerciais;
- deduplicação entre próxima ação oficial da Oportunidade e ação CRM espelhada;
- após RBAC, a fila passou a consultar/exibir cada domínio somente quando a sessão possui a permissão correspondente.

## Pacote 02 — Estados operacionais de tarefa

Arquivo: `012_project_task_states.sql`.

Status: **VALIDADO EM AMBIENTE ISOLADO; NÃO APLICADO À PRODUÇÃO**.

Validações:
- `waiting_partner` exige dependência + próxima checagem;
- `blocked` exige motivo + responsável pelo desbloqueio + impacto + próxima checagem;
- `done` exige evidência;
- mudanças válidas geram auditoria.

## Pacote 03 — Entrada comercial automática P01→P04

Arquivos:
- `023_commercial_prediagnostic_sync.sql`;
- `024_commercial_audit_actor_type.sql`;
- `027_commercial_event_idempotency.sql`.

Status: **VALIDADO EM `blinko-os-v1-sim`**.

Cenário: `Café Aurora — SIMULAÇÃO 002`.

- leitura inicial enviada → P01→P02;
- revisão iniciada → P02→P03;
- revisão concluída → P03→P04;
- responsável/próxima ação/data permanecem obrigatórios;
- auditoria diferencia `system`, `ai` e `human`;
- evento `stage_changed` só ocorre quando a etapa realmente muda.

## Pacote 04 — Descoberta do salto P10→P13

Cenário: `Clínica Lume — SIMULAÇÃO 003`.

Status: **FALHA ESTRUTURAL REPRODUZIDA E CORRIGIDA NOS PACOTES POSTERIORES**.

Foi comprovado que um antigo `contract_reference` textual permitia nascer projeto sem formalização real. A falha motivou os gates 025–026.

## Pacote 05 — Contrato + Condições de Início + Onboarding Modular

Arquivos:
- `025_commercial_formalization_start_gate.sql`;
- `026_project_onboarding_readiness.sql`.

Status: **VALIDADO PONTA A PONTA EM `blinko-os-v1-sim`**.

Cenário: `Estúdio Nexo — SIMULAÇÃO 004`.

- texto livre não substitui contrato válido;
- contrato válido conduz P10→P11→P12;
- condições de início aplicáveis precisam estar resolvidas;
- projeto só nasce em P13 após `ready_for_onboarding=true`;
- onboarding é modular, auditável e reutiliza dados existentes;
- ativação direta ou por função com onboarding incompleto é bloqueada;
- P13→P14/WON só ocorre após prontidão operacional real.

## Pacote 06 — Contatos + Empresa 360

Arquivos:
- `028_contacts_company_360.sql`;
- `029_contact_company_reuse.sql`.

Status: **VALIDADO EM `blinko-os-v1-sim`**.

- Lead pode originar Contato permanente;
- vínculo Contato→Empresa não é inferido por nome;
- Empresa conhecida é reutilizada, evitando duplicação por nova demanda;
- contato criado na Empresa 360 não fabrica Lead;
- Central de Contatos e Empresa 360 implementadas.

## Pacote 07 — Catálogo oficial S01–S40 + gate por solução

Arquivos:
- `030_official_solution_catalog.sql`;
- `031_project_solution_lifecycle_alignment.sql`;
- `032_project_solution_gate_hardening.sql`;
- `033_project_solution_route_control.sql`.

Status: **VALIDADO EM `blinko-os-v1-sim`**.

Fonte: Documento 04 — Catálogo de Soluções e Parceiros v1.0.

- 40/40 soluções oficiais;
- rotas R1–R6 controladas por solução;
- rota incompatível bloqueada;
- solução piloto/consulta cria gate de viabilidade;
- histórico não recebe rota retroativa inventada;
- onboarding não pode fingir confirmação de rota.

Documento detalhado: `docs/BLINKO_OS_V1_SIMULATION_008.md`.

## Pacote 08 — Change Requests

Arquivos:
- `034_project_change_requests.sql`;
- `035_change_request_analysis.sql`;
- `036_change_request_decision_immutability.sql`.

Status: **VALIDADO EM `blinko-os-v1-sim`**.

- diferencia correção, revisão no escopo, mudança de escopo e nova demanda;
- impacto de prazo/financeiro é analisado antes da decisão;
- decisão é imutável/auditável;
- nova demanda pode ser roteada ao Comercial sem deformar o projeto existente.

Documento detalhado: `docs/BLINKO_OS_V1_SIMULATION_009_CHANGE_REQUEST.md`.

## Pacote 09 — Parceiros e compromissos financeiros

Arquivos:
- `037_partner_registry.sql`;
- `038_partner_financial_commitments.sql`;
- `039_partner_project_inheritance.sql`;
- `040_partner_payment_release.sql`.

Status: **VALIDADO EM `blinko-os-v1-sim`**.

- parceiro/capacidade separados de solução;
- compromisso exige rota, evidência e validação humana;
- nenhum percentual/base de repasse é inventado;
- não existe 50% hardcodado;
- parceiro pode ser herdado pelo projeto quando elegível;
- pagamento possui gate próprio e auditoria.

Documento detalhado: `docs/BLINKO_OS_V1_SIMULATION_010_PARTNERS.md`.

## Pacote 10 — Indicadores, metas e parâmetros de indicadores

Arquivos:
- `041_indicators_targets_financial_settings.sql`;
- `042_commercial_estimate_for_forecast.sql`;
- `043_indicator_financial_coverage_guard.sql`.

Status: **VALIDADO EM `blinko-os-v1-sim`**.

- indicadores comerciais, operacionais, financeiros e diagnósticos;
- metas e parâmetros específicos de indicadores versionados com evidência;
- forecast usa estimativa explícita;
- indicador financeiro não finge cobertura quando a base financeira é incompleta.

Documentos:
- `docs/BLINKO_OS_V1_SIMULATION_011_INDICATORS.md`;
- `docs/BLINKO_OS_V1_VALIDATION_011_SUMMARY.md`.

## Pacote 11 — Usuários, papéis e permissões

Arquivos:
- `044_internal_users_roles_permissions.sql`;
- `045_internal_session_revocation.sql`.

Status: **VALIDADO EM `blinko-os-v1-sim` + CI/PREVIEW**.

Fonte: Documento 08 — Sistema e Automação v1.0.

- usuários individuais;
- papéis Admin, Estratégia/Consultoria, Operação, Financeiro, Parceiro e Cliente;
- Parceiro sem login interno na V1 e escopo por projeto;
- Cliente reservado para portal futuro;
- menor privilégio por permissão;
- senha com scrypt + salt;
- login compartilhado apenas como bootstrap;
- `session_version` revoga sessões anteriores após senha/papel/status;
- proteção do último Admin;
- dados financeiros mascarados/não consultados sem `finance.view`;
- confirmação de pagamento exige `finance.manage`;
- mutações de Diagnóstico, Comercial, Projeto, Contatos e Empresa 360 protegidas no endpoint;
- Tela Hoje tornou-se permission-aware no servidor.

Documento: `docs/BLINKO_OS_V1_SIMULATION_012_PERMISSIONS.md`.

Checkpoint `0df279ef9fca6fbb9ae5ac2a485240e352d7f7cc`:
- GitHub CI: success;
- TypeScript: success;
- Next.js build: success;
- Vercel: success.

## Pacote 12 — Configurações, automações e templates versionados

Arquivos:
- `046_versioned_settings_automation_templates.sql`;
- `047_automation_rule_idempotency_across_versions.sql`.

Status: **VALIDADO EM `blinko-os-v1-sim` + GITHUB CI; PREVIEW VERCEL BLOQUEADO POR QUOTA EXTERNA**.

Fonte: Documento 08 — Sistema e Automação v1.0, seções 5.23, 6, 7.11, 11, 12, 16, 17, 18, 22–25.

Estrutura:
- `settings.view` / `settings.manage`, somente Admin na V1;
- parâmetros gerais de negócio com definição estável + versões;
- A01–A25 como catálogo oficial sem ativação automática;
- versões de regra com gatilho, condições, ações, exceções, responsável, resultado esperado, política de falha e evidência;
- log de execução com idempotência;
- 10 tipos oficiais de templates documentais;
- templates versionados por metadados/referência, mantendo o conteúdo no Drive;
- UI `/interno/configuracoes` e endpoints protegidos por `settings.manage`.

Simulação 013:
1. estado inicial: 25 regras, 10 tipos de template, 0 parâmetros inventados, 0 versões ativas por seed;
2. parâmetro sem evidência → recusado;
3. parâmetro V1→V2 → V1 retired e V2 única current;
4. valor textual em parâmetro `number` → recusado;
5. automação determinística pilot/active sem runtime binding → recusada;
6. A24 piloto/manual registrada apenas como fixture de governança;
7. repetição da mesma chave de execução na mesma versão → recusada;
8. 047 endureceu idempotência para `rule_id + idempotency_key`;
9. mesma chave repetida após A24 V2 → recusada;
10. template ativo sem `content_reference` → recusado;
11. template V1→V2 preservou histórico;
12. apenas Admin recebeu `settings.view/settings.manage`.

Os valores e versões usados na Simulação 013 são explicitamente fictícios e não representam política operacional real.

Documento: `docs/BLINKO_OS_V1_SIMULATION_013_SETTINGS.md`.

Checkpoint de código `319c8f9359ab5eed5dba4b08a794bb216181ffa5`:
- GitHub Actions / Blinko CI #338: **success**;
- TypeScript: **success**;
- Next.js build: **success**;
- Vercel: **failure por `build-rate-limit`**, sem build executado; não classificar como regressão de código nem como Preview validado.

## Regra de segurança vigente

- Neon main/produção continua sem as migrações experimentais;
- GitHub `main` continua sem promoção desta frente;
- PR #25 permanece draft;
- DDL/fixtures somente em `blinko-os-v1-sim`;
- Drive continua repositório de arquivos; OS guarda estados, relações, referências e versões;
- configuração não pode inventar preço, margem, repasse, prazo ou parâmetro sem evidência;
- ativar estado de uma regra não publica código arbitrário;
- automações determinísticas pilot/active exigem binding explícito;
- promoção exige plano de migração, bootstrap, rollback e validação isolada.

## Próximas frentes reais

1. **A23 — Ciclos recorrentes**: modelar ciclo sem duplicar/reescrever projeto anterior;
2. **A24 — Renovação**: alertar/abrir ação comercial antes da data definida, usando parâmetro real somente quando formalizado;
3. **A25 — Reavaliação diagnóstica**: criar nova avaliação sem sobrescrever diagnóstico anterior;
4. plano explícito de promoção/rollback das migrações após fechamento funcional da V1.
