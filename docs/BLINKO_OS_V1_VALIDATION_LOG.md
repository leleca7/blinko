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

## Próximas frentes depois deste pacote

1. Entidade geral de Contatos.
2. Empresa como visão 360.
3. Sincronizar catálogo oficial S01–S40 e ligar onboarding específico às soluções contratadas.
4. Change Request: correção vs. ajuste incluso vs. mudança de escopo.
5. Parceiros gerais e regras validadas de repasse.
6. Indicadores comerciais, operacionais, financeiros e de diagnóstico.
7. Usuários/papéis/permissões.
8. Configurações/regras versionadas.
9. Reavaliação, renovação e ciclos recorrentes.
