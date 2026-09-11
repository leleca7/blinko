# Blinko OS v1 — Simulação 010 · Parceiros, regras financeiras e pagamentos

Data: 09/09/2026 (America/Bahia)
Ambiente: Neon `blinko-os-v1-sim` (`br-soft-violet-aw0lfbud`)
Produção/main: **não alterada**

## Objetivo

Validar a cadeia oficial de terceiros antes e depois da contratação:

`Solução → Rota R1–R6 → Parceiro → Cotação/Regra Financeira → Gate comercial → Projeto → Custo → Liberação de pagamento → Pagamento`

Fontes funcionais: Documento 04 — Catálogo de Soluções e Parceiros; Documento 07 — Financeiro e Indicadores.

## Estruturas validadas

- `037_partner_registry.sql`
- `038_partner_financial_commitments.sql`
- `039_partner_project_inheritance.sql`
- `040_partner_payment_release.sql`

### Cadastro e elegibilidade

- P01 — Hélio / Produção Gráfica: `pilot_requires_project_approval`.
- P02 — Parceira Audiovisual: `registration_pending`, portanto bloqueada para compromisso aprovado.
- Capacidades ligadas ao catálogo oficial de soluções, sem transformar cadastro incompleto em elegibilidade.

### Regra financeira gráfica — 50%

O percentual informado de 50% foi preservado na regra do P01, porém:

- `calculation_base_status = to_define`;
- base de incidência = A DEFINIR;
- formalização = pendente;
- `auto_calculable = false`.

Teste de `calculate_partner_rule_amount(..., 1000)`:

**BLOQUEADO**, como esperado. O sistema não calcula os 50% enquanto a base e a formalização não estiverem válidas.

## Simulação 010 — Gráfica Aurora / S24 / R3

Proposta: `50d830c6-33cb-4929-88b5-7483e7f5d68c`
Intervenção S24: `930d954d-d69d-4679-90cc-1d90ffc7c02c`
Rota: R3 — parceiro coordenado pela Blinko.

Parceiro: P01 — Hélio.

Compromisso aprovado atual:

- ID `8084feb3-a87c-47e7-9865-95260b93a3b8`;
- cotação `SIM010-COTACAO-HELIO-002`;
- custo específico para a Blinko: R$ 420,00;
- obrigação financeira Blinko: sim;
- aprovação: `pilot_exception` com evidência humana;
- compromisso pronto: sim.

A regra percentual incompleta não foi usada para calcular R$ 420,00. O valor nasceu da **cotação específica validada**, preservando a distinção entre percentual informado e custo contratualmente verificável.

### Herança para o Projeto

Projeto: `ffaaedc8-774d-40ea-a888-4e62c8bc06fc`.

O compromisso aprovado foi herdado automaticamente para:

- `project_partner_assignments`: `1e4e3345-f0ea-4a50-aa4c-313b60a32bb3`;
- parceiro P01;
- S24 / R3;
- mesma cotação `SIM010-COTACAO-HELIO-002`;
- custo comprometido R$ 420,00.

O financeiro gerou um `project_cost` vinculado ao parceiro e ao compromisso:

- ID `d60f8e2c-f6fd-47f3-9167-d7c3d9e991a1`;
- custo tipo parceiro;
- valor R$ 420,00;
- origem: cotação validada;
- parceiro/regra/solução/assignment vinculados.

Custos de parceiro por texto livre foram bloqueados pela função oficial: devem nascer de compromisso aprovado.

## Simulação 010B — Audiovisual bloqueado

Proposta: `0996485c-af38-411b-9e75-e043748718d4`
Solução: S20
Rota: R3
Parceiro: P02 — cadastro pendente.

Foi possível registrar a cotação como informação pendente, mas a tentativa de aprovar o compromisso retornou:

`BLOQUEADO: parceiro ainda não possui elegibilidade mínima para este compromisso`

Resultado correto: cadastro incompleto não é convertido em autorização operacional.

## Simulação 010C — cálculo automático positivo

Foi criado exclusivamente na branch de simulação um parceiro fictício plenamente validado e uma regra fictícia:

- modelo PRF02;
- percentual 12,5%;
- base de cálculo definida;
- formalização aprovada;
- regra vigente e atual.

Resultado:

- regra válida = true;
- auto calculável = true;
- base de R$ 2.000,00 → cálculo de R$ 250,00.

Isso prova que o motor não bloqueia percentuais por princípio: ele bloqueia apenas regras sem parâmetros formais suficientes.

## Gate de pagamento do parceiro

A obrigação de R$ 420,00 da Simulação 010 passou pelo `040_partner_payment_release.sql`.

Teste 1:

- impacto de caixa = `blocked`;
- pedido de liberação registrado;
- liberação recusada/bloqueada.

Teste 2:

- impacto de caixa = `attention`;
- condição de pagamento e impacto revisados;
- aprovação interna explícita registrada;
- liberação aprovada.

Pagamento final:

- `project_cost.status = paid`;
- valor = R$ 420,00;
- referência `SIM010-PAGAMENTO-PARCEIRO-001`;
- liberação correspondente = `paid`.

Regra validada: obrigação assumida com parceiro permanece própria e rastreável; não é apagada nem presumida pela situação do recebimento do cliente.

## Auditoria

A trilha registrou como eventos humanos, entre outros:

- `proposal_partner_commitment_recorded`;
- `proposal_partner_commitment_approved`;
- `partner_quote_revalidated`;
- `partner_commitment_inherited_to_project`;
- `partner_payment_release_requested`;
- `partner_payment_release_rejected`;
- `partner_payment_release_approved`;
- pagamento do `project_cost` com referência verificável.

## Interface

O fluxo pré-projeto está disponível na proposta em `ProposalPartnerSection`, com:

- escolha de rota R1–R6;
- parceiro obrigatório em R2/R3/R5;
- elegibilidade visível;
- cotação e custo específico;
- aprovação humana do compromisso;
- revalidação de cotação;
- estado do cálculo automático.

O projeto exibe os compromissos herdados e custos vinculados.

Foi adicionada ainda a Central `/interno/parceiros` e a ficha `/interno/parceiros/[id]`, com leitura operacional de:

- cadastro e elegibilidade;
- capacidades por solução;
- regras financeiras versionadas;
- cálculo automático liberado/bloqueado;
- projetos/compromissos/custos relacionados.

A edição direta das regras financeiras não foi aberta nesta rodada: alterações de regra precisam preservar versionamento e formalização, e não devem permitir mutação silenciosa de percentuais/bases vigentes.

## Conclusão

A cadeia de parceiro está operacionalmente estruturada e validada em simulação, incluindo o caso crítico dos 50% da parceria gráfica. Nenhuma regra financeira incompleta é usada para cálculo automático, e nenhum custo de parceiro fica invisível ou desconectado do projeto.

Produção/main permanece intocada. A PR #25 permanece draft até plano explícito de promoção controlada.
