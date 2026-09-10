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

## Pacote 03 — Entrada comercial automática P01→P04

Arquivos:
- `neon/sql/023_commercial_prediagnostic_sync.sql`;
- `neon/sql/024_commercial_audit_actor_type.sql`;
- `neon/sql/027_commercial_event_idempotency.sql`.

Status: **VALIDADO EM `blinko-os-v1-sim`; NÃO APLICADO À MAIN/PRODUÇÃO**

Cenário: `Café Aurora — SIMULAÇÃO 002`.

Validação:
1. oportunidade preparada em P01 com responsável + próxima ação + data;
2. leitura inicial registrada como enviada → **P01→P02 automático**;
3. revisão humana iniciada → **P02→P03 automático**;
4. revisão humana concluída → **P03→P04 automático**;
5. responsável, próxima ação e data permaneceram preenchidos durante todo estado ativo;
6. `commercial_opportunity_events` registrou a trilha esperada;
7. `audit_events` revelou que automações estavam sendo gravadas como `actor_type=human`;
8. migração 024 corrigiu classificação `system`/`ai` e fez backfill apenas de registros inequivocamente automatizados;
9. tela `Hoje` mantém a oportunidade como fonte oficial e remove ação CRM espelhada do mesmo lead;
10. migração 027 impede eventos `stage_changed` quando a etapa não mudou; alteração real apenas da próxima ação vira `next_action_changed`.

## Pacote 04 — Descoberta do salto P10→P13

Cenário: `Clínica Lume — SIMULAÇÃO 003`.

Status: **FALHA ESTRUTURAL REPRODUZIDA E DOCUMENTADA**

Fluxo comprovado antes da correção:
- P04→P05 por criação do diagnóstico;
- P05→P06 ao ficar pronto para apresentação;
- P06→P07 ao criar proposta;
- P07→P08 ao enviar;
- P08→P09 em negociação;
- P09→P10 ao aceitar comercialmente;
- criação de projeto com mero `contract_reference` textual → **P10→P13**;
- projeto alterado para ativo → **P13→P14/WON**.

Conclusão:
> `contract_reference` era apenas evidência textual e não representava contrato válido, condição financeira, pré-requisito ou gate de prontidão. O banco permitia pular P11/P12.

Essa simulação motivou a implementação dos gates oficiais abaixo.

## Pacote 05 — Contrato + Condições de Início + Onboarding Modular

Arquivos:
- `neon/sql/025_commercial_formalization_start_gate.sql`;
- `neon/sql/026_project_onboarding_readiness.sql`.

Status: **VALIDADO PONTA A PONTA EM `blinko-os-v1-sim`; NÃO APLICADO À MAIN/PRODUÇÃO**

Cenário: `Estúdio Nexo — SIMULAÇÃO 004`.

### Formalização e condições de início

Validações:
1. proposta aceita em P10 + texto livre no antigo `contract_reference` → criação do projeto **RECUSADA** com `BLOQUEADO PARA INÍCIO`;
2. contrato apenas enviado/sem aceite válido → **P10→P11**;
3. contrato com aceite válido + data + referência verificável → **P11→P12**;
4. contrato válido sozinho não libera projeto;
5. condições `to_define` impedem o gate;
6. condições obrigatórias pendentes impedem o gate;
7. após decisão explícita de aplicabilidade e satisfação das condições obrigatórias → `ready_for_onboarding=true`;
8. próxima ação muda para `Criar projeto e iniciar onboarding`;
9. projeto passa a ser criado somente após o gate, entrando em **P13**;
10. `projects.contract_reference` é mantido apenas por compatibilidade e recebe a referência do contrato válido, não o texto livre enviado pela interface.

Condições-base modeladas:
- contrato/aceite válido;
- condição financeira/sinal quando aplicável;
- cadastro mínimo;
- briefing mínimo;
- acessos;
- materiais;
- autorizações;
- parceiro validado quando necessário;
- capacidade operacional;
- pré-requisitos da solução.

### Onboarding modular e gate de operação

Validações:
1. projeto em P13 recebe módulos de onboarding sem copiar novamente empresa/diagnóstico/proposta;
2. módulos possuem fonte/referência para reutilizar informação já existente;
3. aplicabilidade `to_define` bloqueia operação;
4. módulo obrigatório pendente bloqueia operação;
5. `done` exige evidência;
6. `blocked` exige motivo, responsável pelo desbloqueio e próxima checagem;
7. `activate_project` com tarefa inicial, mas onboarding incompleto → **RECUSADO** com `BLOQUEADO PARA OPERAÇÃO`;
8. tentativa de `UPDATE projects SET status='active'` direto com onboarding incompleto → **RECUSADA** pelo banco;
9. após concluir módulos obrigatórios e resolver aplicabilidade → `ready_for_operation=true`;
10. próxima ação muda para `Ativar projeto e liberar operação`;
11. ativação válida → **P13→P14 + outcome WON**;
12. lead passa a `won` apenas no fechamento comercial, não no simples nascimento do projeto.

Módulos-base de onboarding:
- responsável operacional confirmado;
- fluxo de comunicação/aprovações definido;
- plano inicial de entregas confirmado;
- linha de base/forma de medição confirmada;
- kickoff concluído;
- configuração específica da solução com aplicabilidade explícita.

## Interface do pacote de prontidão

Implementado na PR #25:
- leitura de contrato, condições de início e readiness sem quebrar módulos antigos;
- endpoint interno para registrar contrato/aceite;
- endpoint interno para atualizar condição de início;
- criação de projeto bloqueada quando `ready_for_onboarding` não é verdadeiro;
- tela de proposta/execução mostra P11, P12, bloqueios e condições;
- nova tela `/interno/projetos/[id]/onboarding` para P13;
- endpoint auditável para atualizar módulos do onboarding;
- ativação bloqueada quando `ready_for_operation` não é verdadeiro;
- ações P13 na tela `Hoje` apontam diretamente para o workspace de onboarding.

## Regra de promoção

As migrações 023–027 foram aplicadas/testadas **somente** em `blinko-os-v1-sim`.

Não houve migração dessas estruturas para Neon main/produção. A PR #25 permanece draft. Antes de qualquer promoção:
1. CI e Preview do HEAD precisam estar verdes;
2. revisar o diff final de 023–027;
3. definir plano de migração/backfill para dados existentes;
4. testar em ambiente isolado a partir do estado atual da produção;
5. promover de forma controlada e auditável.

## Próximas frentes depois deste pacote — histórico

A lista abaixo era o roadmap registrado no checkpoint do pacote 05 e foi posteriormente executada em grande parte:
1. Entidade geral de Contatos.
2. Empresa como visão 360.
3. Sincronizar catálogo oficial S01–S40 e ligar onboarding específico às soluções contratadas.
4. Change Request: correção vs. ajuste incluso vs. mudança de escopo.
5. Parceiros gerais e regras validadas de repasse.
6. Indicadores comerciais, operacionais, financeiros e de diagnóstico.
7. Usuários/papéis/permissões.
8. Configurações/regras versionadas.
9. Reavaliação, renovação e ciclos recorrentes.

---

# Atualização consolidada — 10/09/2026

Os pacotes abaixo foram implementados e validados posteriormente ao checkpoint anterior. As simulações detalhadas permanecem como fonte de evidência específica.

## Pacote 06 — Contatos + Empresa 360

Arquivos:
- `028_contacts_company_360.sql`;
- `029_contact_company_reuse.sql`.

Status: **VALIDADO EM `blinko-os-v1-sim`; NÃO APLICADO À MAIN/PRODUÇÃO**.

Resultados principais:
- Lead passou a poder originar Contato permanente sem transformar toda demanda em nova Empresa;
- vínculo Contato→Empresa é relacional e não é inferido por nome semelhante;
- Empresa conhecida é reutilizada no diagnóstico/pagamento em vez de duplicada;
- criação direta de contato na Empresa 360 não fabrica Lead;
- UI de Contatos e Empresa 360 criada com vínculo manual auditável.

## Pacote 07 — Catálogo oficial S01–S40 + gate por solução

Arquivos:
- `030_official_solution_catalog.sql`;
- `031_project_solution_lifecycle_alignment.sql`;
- `032_project_solution_gate_hardening.sql`;
- `033_project_solution_route_control.sql`.

Status: **VALIDADO EM `blinko-os-v1-sim`; NÃO APLICADO À MAIN/PRODUÇÃO**.

Fonte oficial: Documento 04 — Catálogo de Soluções e Parceiros v1.0.

Resultados principais:
- 40/40 soluções oficiais carregadas;
- rotas R1–R6 controladas por solução;
- rota incompatível é recusada;
- solução piloto/consulta cria gate explícito de viabilidade;
- onboarding não pode marcar rota como concluída sem confirmação pela função especializada;
- histórico anterior é preservado sem inventar rota retroativa;
- Simulação 008 validou S10 ponta a ponta no fluxo de onboarding.

Documento detalhado: `docs/BLINKO_OS_V1_SIMULATION_008.md`.

## Pacote 08 — Change Requests

Arquivos:
- `034_project_change_requests.sql`;
- `035_change_request_analysis.sql`;
- `036_change_request_decision_immutability.sql`.

Status: **VALIDADO EM `blinko-os-v1-sim`; NÃO APLICADO À MAIN/PRODUÇÃO**.

Resultados principais:
- diferencia correção, revisão no escopo, mudança de escopo e nova demanda;
- impacto de prazo/financeiro é registrado antes da decisão;
- decisão fica imutável e auditável;
- nova demanda pode ser encaminhada ao Comercial sem deformar o projeto existente.

Documento detalhado: `docs/BLINKO_OS_V1_SIMULATION_009_CHANGE_REQUEST.md`.

## Pacote 09 — Parceiros e compromissos financeiros

Arquivos:
- `037_partner_registry.sql`;
- `038_partner_financial_commitments.sql`;
- `039_partner_project_inheritance.sql`;
- `040_partner_payment_release.sql`.

Status: **VALIDADO EM `blinko-os-v1-sim`; NÃO APLICADO À MAIN/PRODUÇÃO**.

Resultados principais:
- cadastro e capacidade do parceiro separados da solução;
- cotação/compromisso do parceiro precisa de rota, evidência e validação humana;
- regra financeira não inventa percentual/base pendente e não hardcoda 50%;
- parceiro aprovado pode ser herdado pelo projeto;
- pagamento a parceiro possui gate explícito, auditável e separado da mera existência de custo.

Documento detalhado: `docs/BLINKO_OS_V1_SIMULATION_010_PARTNERS.md`.

## Pacote 10 — Indicadores, metas e parâmetros financeiros

Arquivos:
- `041_indicators_targets_financial_settings.sql`;
- `042_commercial_estimate_for_forecast.sql`;
- `043_indicator_financial_coverage_guard.sql`.

Status: **VALIDADO EM `blinko-os-v1-sim`; NÃO APLICADO À MAIN/PRODUÇÃO**.

Resultados principais:
- indicadores comerciais, operacionais, financeiros e diagnósticos consolidados;
- metas e parâmetros são versionados com evidência;
- forecast usa estimativa comercial explícita;
- indicadores financeiros não fingem cobertura quando a base financeira está incompleta.

Documentos detalhados:
- `docs/BLINKO_OS_V1_SIMULATION_011_INDICATORS.md`;
- `docs/BLINKO_OS_V1_VALIDATION_011_SUMMARY.md`.

## Pacote 11 — Usuários, papéis e permissões

Arquivos:
- `044_internal_users_roles_permissions.sql`;
- `045_internal_session_revocation.sql`.

Status: **VALIDADO EM `blinko-os-v1-sim` + CI/PREVIEW; NÃO APLICADO À MAIN/PRODUÇÃO**.

Fonte funcional: Documento 08 — BLINKO — SISTEMA E AUTOMAÇÃO v1.0.

Resultados principais:
- usuários individuais e matriz fixa V1 com 6 papéis / 30 permissões;
- Admin, Estratégia/Consultoria, Operação e Financeiro habilitados para login interno;
- Parceiro preparado como projeto-escopado, mas login interno desabilitado;
- Cliente reservado para portal futuro;
- senha com scrypt + salt individual;
- login compartilhado rebaixado a bootstrap e desativado após o primeiro usuário individual;
- `session_version` invalida sessão anterior após mudança de senha, papel ou status;
- proteções do último Admin/self-downgrade;
- módulos e mutações internos protegidos por permissão, não apenas por visibilidade de menu;
- Projeto e Change Request respeitam escopo por projeto;
- custo/termos financeiros de parceiro, resumo financeiro de projeto e séries financeiras são mascarados/não entregues sem `finance.view`;
- confirmação de pagamento do diagnóstico exige `finance.manage`;
- tela Hoje foi corrigida para consultar/exibir CRM, projetos, alterações, aprovações e recebíveis conforme as permissões da sessão.

Simulação 012/012B:
1. primeiro usuário não-Admin → recusado;
2. Operação sem `finance.view`;
3. Financeiro sem `diagnostics.manage`;
4. Parceiro sem acesso global;
5. grant explícito de projeto → acesso permitido somente ao projeto concedido;
6. revoke → acesso perdido imediatamente;
7. `session_version` validado em sequência 1→2→3→4;
8. tentativa de remover o próprio Admin protegido → recusada;
9. transação revertida propositalmente;
10. verificação final: **0 usuários persistentes** e auth individual ainda não inicializado.

Documento detalhado: `docs/BLINKO_OS_V1_SIMULATION_012_PERMISSIONS.md`.

Checkpoint de código validado: `6488440f5f2fb511192c4a0a86c06cf1d22d61b7`.
- GitHub Actions / Blinko CI run #327: **success**;
- TypeScript: **success**;
- Next.js build: **success**;
- Vercel: **success — Deployment has completed**.

## Regra de segurança vigente após o pacote 11

- Neon main/produção permanece intocada pelas migrações 028–045;
- GitHub `main` permanece intocada;
- PR #25 permanece draft;
- migrations/test fixtures somente em `blinko-os-v1-sim`;
- nenhuma credencial fictícia da Simulação 012 ficou persistida;
- promoção do auth exige plano explícito para bootstrap do primeiro Admin, rollback e prevenção de lockout.

## Próximas frentes reais

A lista histórica acima foi majoritariamente concluída. Permanecem como continuidade natural do roadmap:
1. Configurações/regras versionadas além de usuários, onde ainda houver regra operacional não parametrizada;
2. Reavaliação, renovação e ciclos recorrentes;
3. revisão de promoção controlada das migrações, sem aplicar automaticamente à produção.
