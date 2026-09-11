# Blinko OS v1 — Plano controlado de promoção e rollback

Data: 10/09/2026  
Escopo: migrações `012`–`048` da branch `feat/blinko-os-v1-audit`  
Estado: **PLANO — NÃO AUTORIZA PROMOÇÃO AUTOMÁTICA**

## 1. Objetivo

Definir como levar o Blinko OS v1 do ambiente `blinko-os-v1-sim` para produção com risco controlado, sem tratar `merge` de código como autorização de alteração de banco e sem depender de rollback destrutivo improvisado.

Este documento é uma preparação operacional. **Nenhuma etapa de produção deve ser executada sem decisão explícita de go-live.**

## 2. Princípios de promoção

1. GitHub `main` e Neon produção são decisões separadas.
2. Migração de schema deve ser aditiva sempre que possível.
3. Antes de cada pacote, registrar snapshot/estado lógico necessário para conferência.
4. Dados existentes não devem receber valores inventados para satisfazer novos campos.
5. Backfill só ocorre quando a relação é inequívoca.
6. Onde não houver informação suficiente, usar estado explícito como `to_define`, `pending` ou ausência controlada.
7. Não fazer merge por nome de Empresa, Contato, parceiro ou solução.
8. Não ativar automações A01–A25 apenas porque o catálogo existe.
9. Regras financeiras sem parâmetro formal permanecem sem cálculo automático.
10. Para alterações já utilizadas por registros novos, preferir **forward-fix** a rollback destrutivo.

## 3. Unidades de promoção

As migrações devem ser tratadas por pacotes funcionais, ainda que aplicadas em ordem numérica.

### P0 — Base legada / pré-requisitos

Migrações `012`–`022`.

Risco: **alto**, porque estas estruturas são dependências de praticamente todo o restante.

Go/no-go:
- confirmar que produção possui exatamente o baseline esperado;
- comparar schema antes de aplicar;
- interromper se houver divergência estrutural não explicada.

### P1 — Comercial, formalização e onboarding

Migrações `023`–`027`.  
Risco: **alto**.

Pré-checks:
- oportunidades ativas com owner/próxima ação/data;
- propostas aceitas existentes;
- projetos que nasceram antes do gate;
- contratos/referências históricas disponíveis.

Backfill:
- não transformar `contract_reference` textual em contrato válido automaticamente;
- registros históricos incompatíveis devem ser classificados como legado e tratados explicitamente.

### P2 — Contatos e Empresa 360

Migrações `028`–`029`.  
Risco: **médio**.

Backfill:
- somente relações determinísticas;
- nunca unir Empresas por nome parecido.

### P3 — Catálogo S01–S40 e rotas R1–R6

Migrações `030`–`033`.  
Risco: **médio-alto**.

Backfill:
- vincular blueprint oficial apenas quando houver correspondência inequívoca;
- não inventar rota retroativa.

### P4 — Change Requests

Migrações `034`–`036`.  
Risco: **médio**.

Regras:
- manter `change_request_id` opcional para histórico;
- não converter tarefas antigas em alteração por inferência.

### P5 — Parceiros e financeiro de parceiros

Migrações `037`–`040`.  
Risco: **alto**.

Backfill:
- parceiro textual só recebe FK quando a identidade for inequívoca;
- regra de 50% da parceria gráfica permanece `base A DEFINIR` / cálculo automático bloqueado até formalização.

### P6 — Indicadores e parâmetros

Migrações `041`–`043`.  
Risco: **médio-alto**.

Regra:
- não criar meta/margem/reserva fictícia;
- indicadores sem cobertura suficiente devem declarar cobertura insuficiente.

### P7 — Usuários/RBAC

Migrações `044`–`045`.  
Risco: **crítico** por possibilidade de lockout administrativo.

Ordem obrigatória:
1. aplicar schema de usuários/papéis/permissões;
2. manter bootstrap legado enquanto `internal_individual_auth_initialized()` for falso;
3. criar primeiro Admin individual com credencial forte por canal seguro;
4. validar login do novo Admin em sessão separada;
5. validar `settings.users.manage` e acesso global;
6. somente então considerar o bootstrap compartilhado substituído;
7. testar mudança de senha/role/status e revogação por `session_version`.

No-go imediato:
- primeiro usuário individual não é Admin;
- sessão Admin nova não autentica;
- segredo de sessão não possui configuração válida;
- aplicação aponta para banco/branch incorretos.

### P8 — Configurações governadas

Migrações `046`–`047`.  
Risco: **médio**.

Regras:
- A01–A25 podem ser catalogadas sem ativar runtime;
- regra determinística só pode ficar piloto/ativa quando existir binding real;
- templates ativos precisam de referência válida ao Drive;
- idempotência é por regra + chave através das versões.

### P9 — Recorrência, renovação e reavaliação

Migração `048`.  
Risco: **médio-alto**.

Backfill:
- não criar plano recorrente automaticamente para todo projeto ativo;
- não inventar data de renovação;
- não criar ciclos históricos artificiais;
- `service_cycle_id` permanece nulo em histórico salvo atribuição inequívoca e revisada;
- reavaliação sempre gera novo diagnóstico; nunca sobrescreve o anterior.

## 4. Sequência operacional de go-live

### Fase A — Pré-flight somente leitura

Executar sem DDL:
- registrar commit candidato;
- conferir versão/schema atual;
- contar entidades críticas;
- detectar constraints/colunas conflitantes;
- listar dados que exigem decisão manual de backfill;
- confirmar estratégia de restauração/PITR disponível no provedor.

Resultado obrigatório: `GO`, `GO COM PENDÊNCIAS CONTROLADAS` ou `NO-GO`.

### Fase B — Ensaio a partir da produção

Antes do go-live:
- criar branch temporária a partir do estado atual da produção;
- aplicar `012`→`048` na ordem;
- rodar pré-checks e smoke tests;
- registrar duração e falhas;
- corrigir por nova migração/forward-fix e repetir o ensaio.

### Fase C — Janela de promoção

Somente após autorização explícita:
1. congelar mudanças concorrentes de schema;
2. registrar commit exato;
3. aplicar migrações na ordem;
4. executar smoke tests após pacotes críticos;
5. parar imediatamente em qualquer invariant failure;
6. não prosseguir esperando que uma migração posterior corrija a anterior.

### Fase D — Aplicação

Apontar a aplicação para o schema promovido somente depois de:
- auth/bootstrap validado;
- fila Hoje funcionando;
- Comercial/Projeto funcionando;
- financeiro protegido por RBAC;
- Configurações protegidas;
- Recorrência degradando com segurança quando não configurada.

## 5. Smoke tests obrigatórios pós-promoção

### Autenticação/RBAC
- bootstrap antes do primeiro Admin;
- login individual Admin;
- Operação sem `finance.view` não recebe valores financeiros;
- sessão sem `diagnostics.view` não recebe reavaliações;
- sessão sem `contracts.view` não recebe dados contratuais/renovação;
- mudança de senha invalida sessão anterior.

### Comercial
- oportunidade ativa exige owner + próxima ação + data;
- contrato inválido não libera P12/P13;
- projeto não nasce antes do gate;
- P14/WON somente após prontidão operacional.

### Diagnóstico
- coleta/análise/revisão preservam versões;
- decisão estratégica exige humano;
- reavaliação cria diagnóstico novo com lineage.

### Projeto
- tarefa bloqueada exige causa/responsável/impacto/rechecagem;
- `done` exige evidência;
- onboarding incompleto bloqueia ativação;
- change request bloqueia execução antes de aprovação.

### Parceiros/Financeiro
- parceiro pendente não fica elegível;
- repasse sem base definida não é calculado;
- pagamento exige evidências/gates;
- indicador financeiro sem cobertura não se apresenta como confiável.

### Recorrência
- plano ativo exige contrato válido e evidência;
- ciclo com tarefa aberta não fecha;
- carry-over exige justificativa;
- próximo ciclo respeita revisão de renovação;
- A24 não duplica Empresa/Contato/Lead;
- A25 não altera oportunidade/diagnóstico histórico.

## 6. Estratégia de rollback

### Antes de escrita real no novo schema

Se a falha ocorrer imediatamente após DDL e antes de uso:
- preferir restauração/PITR ou retorno ao snapshot/branch validado;
- reverter deployment da aplicação;
- validar consistência antes de reabrir escrita.

### Depois de existir escrita no novo schema

Não executar `DROP TABLE`, `DROP COLUMN` ou remoção de constraints automaticamente.

Preferir:
1. desabilitar a funcionalidade afetada;
2. preservar dados novos;
3. aplicar forward-fix aditivo;
4. revalidar;
5. remover estruturas somente depois de backup, reconciliação e aprovação específica.

### Auth/RBAC

Se o primeiro Admin falhar:
- não criar usuário não-Admin como workaround;
- preservar bootstrap enquanto a inicialização individual não estiver concluída;
- se houver estado inconsistente, interromper rollout e restaurar o estado seguro.

### Comercial/Operação

Se gates novos bloquearem histórico legítimo:
- não relaxar trigger global;
- classificar registros históricos incompatíveis;
- criar compatibilidade/backfill específico e auditável.

## 7. Critérios de GO

Todos devem ser verdadeiros:
- CI do commit candidato verde;
- ensaio 012–048 verde sobre clone atual da produção;
- nenhum conflito de schema pendente;
- plano do primeiro Admin validado;
- variáveis de ambiente revisadas sem expor segredos;
- smoke tests críticos executáveis;
- responsáveis por go-live e rollback identificados;
- janela de mudança aprovada;
- nenhuma A01–A25 ativada sem binding/validação;
- parâmetros ausentes continuam bloqueando decisões automáticas dependentes.

## 8. Critérios de NO-GO

Qualquer um interrompe promoção:
- schema diverge do baseline de forma não explicada;
- migração falha no ensaio;
- primeiro Admin não autentica;
- aplicação expõe domínio restrito sem permissão;
- backfill depende de matching por nome/suposição;
- dados reais exigiriam preenchimento inventado;
- parceiro/percentual sem regra formal seria automatizado;
- aplicação aponta para banco incorreto;
- não existe caminho verificado de restauração/forward-fix.

## 9. Estado atual

Este plano foi criado após as validações funcionais até a Simulação 014. Ele **não executa e não autoriza** qualquer alteração em GitHub `main`, Neon produção ou deployment de produção.

Próximo passo seguro: **pré-flight somente leitura** sobre produção e ensaio em branch temporária derivada da produção. A aplicação das migrações em produção continua dependendo de autorização explícita.
