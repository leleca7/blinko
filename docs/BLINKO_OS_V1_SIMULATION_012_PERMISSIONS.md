# Blinko OS v1 — Simulação 012 — Usuários, papéis e permissões

Data: 10/09/2026
Branch GitHub: `feat/blinko-os-v1-audit`
PR: #25 — draft
Ambiente de banco: Neon `blinko-os-v1-sim` (`br-soft-violet-aw0lfbud`), database `neondb`

## Fonte funcional

Autoridade usada para esta frente: **Documento 08 — BLINKO — SISTEMA E AUTOMAÇÃO, v1.0 — 09/09/2026**.

Regras aplicadas:
- identidade individual;
- permissões por papel;
- menor privilégio;
- proteção especial para financeiro, contratos e credenciais;
- auditoria associada ao usuário real;
- parceiro limitado ao escopo explicitamente concedido;
- revogação de acesso efetiva;
- cliente reservado para portal futuro;
- não simular revisão em quatro olhos quando a operação real não possuir duas pessoas distintas.

## Migrações

- `neon/sql/044_internal_users_roles_permissions.sql`
- `neon/sql/045_internal_session_revocation.sql`

As duas migrações foram aplicadas **somente** em `blinko-os-v1-sim`. Nenhuma DDL desta frente foi aplicada à Neon main/produção.

## Modelo de acesso V1

Papéis oficiais implementados:
- `admin` — acesso integral e administração de usuários;
- `strategy_consulting` — diagnóstico, estratégia, comercial, relacionamento e projetos, sem financeiro irrestrito;
- `operations` — execução, tarefas, arquivos, aprovações, alterações e parceiros, sem gestão financeira/comercial/diagnóstica;
- `financial` — financeiro, contratos, recebíveis, custos, pagamentos a parceiros e indicadores permitidos;
- `partner` — infraestrutura projeto-escopada, com login interno **desabilitado** nesta V1;
- `client` — reservado para portal futuro, sem permissões/login internos.

A matriz possui **30 permissões** agrupadas por domínio. Nesta V1 a matriz é fixa e versionada em migração; o administrador atribui um papel ao usuário, mas não edita permissões arbitrárias por usuário.

## Bootstrap e identidade individual

O login compartilhado anterior foi preservado exclusivamente como **bootstrap inicial**.

Comportamento validado:
1. enquanto não existir nenhum usuário individual, o bootstrap legado pode iniciar a configuração;
2. o primeiro usuário individual obrigatoriamente deve ser `admin`;
3. assim que existir o primeiro usuário individual, o modo compartilhado deixa de autenticar;
4. o bootstrap não reaparece automaticamente caso usuários sejam posteriormente desativados;
5. nenhuma senha individual é armazenada em texto aberto.

As senhas individuais usam `scrypt` com salt individual. O cookie de sessão continua assinado, `httpOnly` e com tempo limitado, mas cada requisição individual revalida usuário, status, papel e permissões no banco.

## Revogação imediata de sessão

A migração 045 adicionou `session_version`.

Mudanças de:
- senha;
- papel;
- status ativo/desativado

incrementam a versão da sessão. Um cookie emitido antes da alteração deixa de ser aceito na requisição seguinte.

Na Simulação 012B foi comprovada a sequência **1 → 2 → 3 → 4** após alterações sucessivas de papel, senha e status.

## Simulação 012 — testes de RBAC

Os usuários abaixo foram criados somente dentro de uma transação de teste deliberadamente revertida.

Validações:
1. tentativa de criar o primeiro usuário como não-Admin → **RECUSADA**;
2. primeiro Admin conseguiu criar usuários de Operação, Financeiro e Parceiro para o teste;
3. Operação não possuía `finance.view`;
4. Financeiro não possuía `diagnostics.manage`;
5. Parceiro não obteve acesso global a projeto;
6. após concessão explícita em `internal_user_project_access`, o Parceiro passou a acessar somente o projeto concedido;
7. após revogação da concessão, o acesso ao projeto foi perdido imediatamente;
8. tentativa de remover/rebaixar o próprio Admin protegido → **RECUSADA**;
9. alterações de senha/papel/status incrementaram `session_version` e invalidam cookies anteriores.

Ao final, a transação foi revertida propositalmente. Verificação posterior:
- usuários individuais persistentes: **0**;
- `internal_individual_auth_initialized()`: **false**.

Portanto, nenhuma credencial fictícia ficou ativa e o bootstrap da simulação permaneceu intacto.

## Proteção aplicada à interface e APIs

A autorização não depende apenas de esconder menus.

Foram adicionados guards server-side por módulo para:
- Hoje;
- Comercial e Pré-diagnósticos;
- Empresas;
- Contatos;
- Diagnósticos;
- Soluções;
- Projetos;
- Parceiros;
- Alterações;
- Indicadores;
- Configurações de usuários.

As principais mutações internas passaram a exigir permissões específicas:
- `commercial.manage`: pipeline, interações, pré-diagnóstico, proposta e fatos comerciais;
- `diagnostics.manage`: coleta, análise, revisão, estratégia e apresentação do diagnóstico;
- `contacts.manage`: criação/vínculo de contatos permanentes;
- `projects.manage`: onboarding, rota de solução, ativação, criação pós-gate e encerramento;
- `tasks.manage`: tarefas, respeitando escopo do projeto;
- `changes.manage`: Change Requests, respeitando escopo do projeto;
- `contracts.manage`: registro de contrato/formalização;
- `finance.manage`: confirmação de fatos financeiros como pagamento do diagnóstico;
- `indicators.configure`: metas e parâmetros de forecast;
- `settings.users.manage`: administração de usuários.

Login e logout permanecem como exceções intencionais de autenticação.

## Dados financeiros e agregadores

A frente também corrigiu superfícies que poderiam vazar dados mesmo sem botão de edição:
- Indicadores separa consultas financeiras e não entrega séries financeiras sem `finance.view`;
- contexto de parceiro mascara custo interno, obrigação de pagamento, termos e regra financeira sem `finance.view`;
- extensões do Projeto não entregam resumo financeiro nem nota financeira de encerramento sem `finance.view`;
- a tela **Hoje** foi tornada permission-aware: CRM, projetos, aprovações, alterações e recebíveis entram na fila somente conforme as permissões da sessão, e contadores não autorizados não são exibidos.

Esse último item foi encontrado durante a auditoria final da frente e corrigido antes do fechamento.

## Checkpoint de código validado

Checkpoint: `6488440f5f2fb511192c4a0a86c06cf1d22d61b7`.

Resultados:
- GitHub Actions — Blinko CI run #327: **success**;
- TypeScript: **success**;
- Next.js build: **success**;
- Vercel status: **success** — `Deployment has completed`.

## Limites deliberados desta V1

- Parceiro possui infraestrutura de escopo, mas login interno continua desabilitado até existir uma superfície externa específica e segura.
- Cliente não recebe login interno; portal do cliente continua futuro.
- Não há edição livre de permissões por usuário; a matriz é controlada por papel.
- Não foi criada uma falsa exigência de duas pessoas para aprovar operações quando a estrutura real tiver apenas uma pessoa.
- A promoção das migrações 044–045 para produção exige plano explícito de migração, criação segura do primeiro Admin e teste de rollback/lockout.

## Estado de segurança

- Neon main/produção: **intocada** nesta frente.
- GitHub `main`: **intocada**.
- PR #25: permanece **draft**.
- DDL/testes: somente `blinko-os-v1-sim`.
