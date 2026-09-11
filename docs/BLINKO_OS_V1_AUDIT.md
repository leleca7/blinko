# Blinko OS v1 — Auditoria técnica inicial

Data: 09/09/2026
Branch: `feat/blinko-os-v1-audit`
Fonte funcional: `08 — BLINKO — SISTEMA E AUTOMAÇÃO` v1.0

## Objetivo

Comparar a arquitetura funcional oficial da Blinko com o sistema que já existe em GitHub, Vercel e Neon, classificando cada frente em quatro estados:

- **JÁ EXISTE** — fluxo utilizável no código/banco atual.
- **PARCIAL** — há entidade, tela ou automação, mas falta parte relevante do requisito oficial.
- **PRECISA AJUSTAR** — existe, porém a regra/status/estrutura não está alinhada ao documento oficial.
- **NÃO EXISTE** — ainda precisa ser implementado.

## Infraestrutura

| Frente | Estado | Evidência atual | Próximo passo |
|---|---|---|---|
| Next.js / App Router | JÁ EXISTE | Aplicação `blinko` em Next.js | manter |
| Vercel | JÁ EXISTE | Projeto conectado ao GitHub | usar previews por branch/PR |
| GitHub | JÁ EXISTE | `leleca7/blinko`, `main` + branches/PRs | desenvolvimento sempre por branch |
| PostgreSQL / Neon | JÁ EXISTE | Projeto Neon `blinko`, branch `main` e branches de teste | manter isolamento de testes |
| CI | PARCIAL | typecheck + build em PR para `main` | adicionar testes de fluxo depois |
| Auditoria | JÁ EXISTE | `audit_events` e funções que registram eventos | expandir para automações novas |
| IA opcional | JÁ EXISTE | provider pode ficar desativado | não tornar dependência da V1 |

## Módulos do MVP

| Módulo | Estado | O que já existe | Lacuna principal |
|---|---|---|---|
| Empresas | PARCIAL | tabela `companies`, lista e detalhe interno | contatos, dados cadastrais completos, Drive, visão 360 financeira/comercial/projetos |
| Contatos | NÃO EXISTE como entidade própria | dados estão principalmente no lead | criar entidade de contatos vinculada à empresa |
| Pré-diagnóstico | JÁ EXISTE | formulário, análise, revisão humana, leitura inicial, ações CRM | alinhar entrada com rota comercial oficial |
| Diagnóstico | PARCIAL | diagnóstico, coleta, análise, problemas, causas, prioridades e intervenções | questionário oficial 114 itens, maturidade 0–4/NV/N-A, completude por pilar, ICB oficial e reavaliação |
| Soluções | PARCIAL | blueprints, kits, company_solutions | sincronizar catálogo S01–S40 e pré-requisitos/status oficiais |
| Comercial | PARCIAL | leads, crm_actions, proposta e eventos externos; PR #24 adiciona módulo gráfico | pipeline oficial P00–P14, oportunidade própria, próxima ação obrigatória, motivo de perda e forecast |
| Propostas | PARCIAL | proposals + versions + aprovação interna + aceite externo | tipos PR-*, financeiro/margem/desconto e geração documental |
| Contratos | PARCIAL | `contract_reference` no projeto; contratos gráficos na branch experimental | entidade geral de contrato e condições de início/renovação |
| Onboarding | PARCIAL | projeto nasce em onboarding e exige tarefa antes de ativar | checklist modular por solução, materiais/acessos, prontidão operacional |
| Projetos | PARCIAL | projects + página de projeto + ativação | status OPJ00–OPJ11, saúde, parceiro, bloqueios, encerramento e ciclos recorrentes |
| Tarefas | PARCIAL | project_tasks com prazo, responsável, dependências, prioridade, evidência e aprovação requerida | waiting_partner, blocked, motivo/responsável/next-check, conclusão/QA e dependências relacionais |
| Hoje | PARCIAL → EM EVOLUÇÃO | fila CRM existente; nesta branch passou a incluir project_tasks e waiting_client | waiting_partner, bloqueados, aprovações, cobranças, reuniões e alertas críticos |
| Arquivos / Drive | NÃO EXISTE como módulo operacional | Drive existe externamente | entidade de arquivo, pasta por empresa/projeto, upload roteado e versionamento lógico |
| Aprovações | NÃO EXISTE como entidade geral | `approval_required` existe em tarefa; propostas têm revisão interna | entregável/versão/status/comentário/evidência + follow-up |
| Financeiro | NÃO EXISTE no núcleo geral | módulo gráfico experimental tem estrutura própria | recebíveis, despesas, repasses, margem, caixa e rentabilidade por projeto |
| Parceiros | NÃO EXISTE no núcleo geral | fornecedor gráfico experimental | cadastro geral, status, capacidade, condições, qualidade e histórico |
| Indicadores | PARCIAL | métricas pontuais no dashboard/comercial | financeiro + comercial + clientes + operação + Método Blinko |
| Configurações / Regras | NÃO EXISTE como módulo | regras vivem no código/SQL | parâmetros, templates, automações, versões, ativação e logs |
| Permissões | PRECISA AJUSTAR | login interno único por env | usuários individuais + papéis + menor privilégio |

## Automações A01–A25

### Já existem ou possuem base forte

- **A01 Nova empresa/lead** — base parcial por lead/pré-diagnóstico.
- **A03 Diagnóstico iniciado** — existe criação e fluxo de diagnóstico.
- **A05 Prioridade validada** — existe base de prioridades/intervenções.
- **A06 Proposta criada** — existe proposta versionada.
- **A08 Oportunidade ganha / contratação formalizada** — aceite externo gera ação para confirmação de contratação.
- **A11 Projeto criado** — projeto nasce após proposta aceita/confirmada.
- **Log/Auditoria** — eventos relevantes já são gravados em `audit_events`.

### Parciais

- A02 próxima ação obrigatória.
- A04 cálculo oficial de maturidade/completude/ICB.
- A09 contrato + pasta + tarefas + recebíveis.
- A10 onboarding modular.
- A12 aguardando cliente.
- A15 QA antes de aprovação externa.
- A16/A17 ciclo de aprovação.
- A22 encerramento completo.

### Ainda não implementadas de forma geral

- A07 margem/desconto no núcleo.
- A13 aguardando parceiro.
- A14 bloqueio estruturado.
- A18 classificação correção/revisão/mudança de escopo.
- A19/A20 cobrança e inadimplência.
- A21 repasses.
- A23 ciclos recorrentes.
- A24 renovação.
- A25 reavaliação diagnóstica automática.

## Riscos encontrados

1. **Dois modelos comerciais convivendo**: núcleo diagnóstico/comercial atual e módulo gráfico da PR #24. Precisam convergir para entidades compartilhadas sem transformar a gráfica no modelo central do OS.
2. **Status atuais são menores que os status oficiais**: leads/projetos/tarefas ainda usam vocabulários anteriores ao Documento 05/06/08.
3. **Empresa ainda não é a verdadeira visão 360**: a tela atual prioriza sistemas conectados, não diagnóstico + comercial + projetos + financeiro + arquivos.
4. **Sem módulo geral de contrato/financeiro/aprovação/arquivo** o fluxo ainda termina cedo demais após ativar projeto.
5. **Autenticação interna é credencial única por ambiente**, adequada para fase inicial, mas insuficiente para papéis e trilha por usuário.
6. **A PR gráfica possui cálculo com participação padrão de 50% sobre margem**, enquanto o Documento 07 determina que a base da parceria ainda precisa ser formalizada. Essa regra não deve ser promovida ao núcleo financeiro como padrão antes da validação.

## Ordem de implementação recomendada

### Sprint 01 — núcleo operacional sem mudança estrutural de banco
1. Evoluir `Hoje` para juntar CRM + project_tasks. **INICIADO nesta branch.**
2. Mostrar vencidos, hoje e aguardando cliente.
3. Consolidar auditoria técnica e fluxo de simulação.

### Sprint 02 — tarefa operacional completa
1. Expandir task statuses para `waiting_partner` e `blocked`.
2. Adicionar `blocked_reason`, `unblock_owner`, `next_check_at`.
3. Ações para mover tarefa entre executar / aguardando cliente / aguardando parceiro / bloqueado.
4. Atualizar `Hoje` para quatro grupos oficiais.

### Sprint 03 — comercial oficial
1. Criar entidade/visão de oportunidade alinhada a P00–P14.
2. Próxima ação obrigatória.
3. Motivo de perda obrigatório.
4. Unificar o módulo gráfico com o comercial geral sem duplicar cliente/lead/proposta.

### Sprint 04 — onboarding, contrato e prontidão
1. Entidade geral de contrato.
2. Condições de início.
3. Checklist de onboarding modular por solução.
4. Projeto só avança quando prontidão estiver satisfeita.

### Sprint 05 — Drive + aprovações
1. Arquivos e pasta contextual.
2. Upload roteado.
3. Entregáveis e versões.
4. Aprovação externa + histórico + follow-up.

### Sprint 06 — financeiro básico
1. Recebíveis.
2. Despesas/custos.
3. Repasse somente com regra validada.
4. Margem projetada/realizada.
5. Alertas de vencimento.

### Sprint 07 — diagnóstico oficial e catálogo
1. Congelar banco das 114 perguntas.
2. Scoring 0–4/NV/N-A.
3. Completude e inconclusividade por pilar.
4. ICB e prioridades.
5. Vincular S01–S40.

### Sprint 08 — indicadores, permissões e automações
1. Dashboards essenciais.
2. Usuários/papéis.
3. Regras configuráveis e idempotência.
4. Reavaliação, renovação e ciclos recorrentes.

## Critério de prontidão para primeiro cliente real

O Blinko OS estará pronto para receber o primeiro cliente quando um cenário fictício conseguir percorrer, sem controle paralelo obrigatório:

`Lead → Qualificação → Diagnóstico → Prioridades → Soluções → Proposta → Aceite → Contrato → Onboarding → Projeto → Tarefas → Arquivos/Aprovação → Financeiro → Entrega → Encerramento`

E quando a tela `Hoje` responder, com dados do sistema:

- o que a Blinko precisa fazer;
- o que está vencido;
- o que está aguardando cliente;
- o que está aguardando parceiro;
- o que está bloqueado;
- qual é a próxima ação comercial/financeira.
