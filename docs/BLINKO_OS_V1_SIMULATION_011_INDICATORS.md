# Blinko OS v1 — Simulação 011 · Indicadores, metas e forecast

Data: 09/09/2026 (America/Bahia)
Ambiente: Neon `blinko-os-v1-sim` (`br-soft-violet-aw0lfbud`)
Produção/main: **não alterada**

## Objetivo

Validar a camada `MEDIR → MELHORAR` sem criar números por inferência indevida.

Princípio testado:

> Um indicador só pode exibir valor quando fórmula, fonte e parâmetros necessários estiverem disponíveis. Meta é configuração versionada e separada do valor observado.

Fontes funcionais: Documento 07 — Financeiro e Indicadores; Documento 05 — Comercial e Jornada do Cliente.

## Migrações desta rodada

- `041_indicators_targets_financial_settings.sql`
- `042_commercial_estimate_for_forecast.sql`
- `043_indicator_financial_coverage_guard.sql`

Todas foram aplicadas/testadas **somente** na branch Neon de simulação.

## Catálogo de indicadores

A migração 041 criou um catálogo explícito com 38 indicadores distribuídos em quatro domínios:

- Comercial: 12;
- Operação: 11;
- Financeiro: 11;
- Diagnóstico: 4.

Cada definição registra:

- código;
- domínio;
- nome;
- unidade;
- descrição da fórmula;
- descrição da fonte;
- status de implementação;
- parâmetro requerido, quando aplicável;
- ordem de exibição;
- documento/versão de origem.

## Estados de cálculo

Foram separados quatro estados:

- `calculated` — fórmula e fonte suficientes;
- `insufficient_data` — fórmula existe, mas os dados atuais não permitem resultado confiável;
- `parameter_not_configured` — falta configuração deliberada necessária ao cálculo;
- `source_not_available` — a fonte ainda não está normalizada de forma segura.

O sistema não converte nenhum desses três últimos estados em zero.

## Primeira leitura da simulação

Antes de configurar pesos do forecast:

- `COM_LEADS_TOTAL` = 9;
- `COM_QUALIFIED_OPPORTUNITIES` = 8;
- `COM_CONVERSION_PCT` = 100% sobre as oportunidades já encerradas no ambiente fictício;
- `COM_WITHOUT_NEXT_ACTION` = 0;
- `COM_OVERDUE_FOLLOWUPS` = 4;
- `OPS_TASKS_ON_TIME_PCT` = 100%;
- `OPS_REWORK_COUNT` = 2;
- `FIN_NET_CONTRACTED_REVENUE` = R$ 4.800,00;
- `FIN_REALIZED_COSTS` = R$ 3.020,00;
- `FIN_CASH_RECEIVED` = R$ 4.800,00;
- `FIN_CASH_OUT` = R$ 1.420,00;
- `FIN_NET_CASH` = R$ 3.380,00;
- `FIN_PARTNER_REPASSES_PAID` = R$ 1.120,00;
- `DIAG_AVG_MATURITY` = 50%;
- `DIAG_AVG_COMPLETENESS` = 7,96%;
- `DIAG_CRITICAL_FINDINGS` = 1.

Esses valores pertencem somente ao conjunto de simulações acumuladas na branch de teste e **não representam indicadores reais da Blinko**.

## Indicadores corretamente bloqueados

### Valor proposto

`COM_PROPOSED_VALUE` ficou `source_not_available`.

Motivo: `proposal_versions.investment` ainda é texto livre. Somar ou extrair moeda desse texto automaticamente criaria risco de erro semântico.

### Rentabilidade por solução

`FIN_SOLUTION_PROFITABILITY` ficou `source_not_available`.

Motivo: os custos já podem apontar para `project_solution_id`, porém a receita contratada ainda não possui alocação normalizada por solução.

### Tempo bloqueado

`OPS_BLOCKED_TIME_HOURS` ficou `source_not_available`.

Motivo: o estado atual das tarefas é conhecido, mas ainda não existe histórico temporal normalizado suficiente para somar intervalos de bloqueio.

### Incidentes e atraso de parceiro

Também permaneceram sem cálculo até existir fonte operacional específica e comparável.

### Evolução diagnóstica

`DIAG_REASSESSMENT_EVOLUTION` ficou `insufficient_data` porque nenhuma empresa da simulação possui duas medições diagnósticas comparáveis.

## Forecast — parâmetro deliberado

O forecast ponderado exige um parâmetro `stage_weights` contendo pesos de P01 a P13.

Antes da configuração:

- valor = `NULL`;
- estado = `parameter_not_configured`;
- motivo = pesos P01–P13 ainda não formalmente configurados.

### Teste negativo

Foi enviada uma configuração fictícia sem P13.

Resultado:

`stage_weights missing P13`

A transação foi recusada e nenhuma configuração parcial ficou corrente.

### Teste positivo

Foi registrada uma versão fictícia exclusivamente para a Simulação 011:

- P01 5%;
- P02 10%;
- P03 15%;
- P04 20%;
- P05 30%;
- P06 40%;
- P07 50%;
- P08 60%;
- P09 70%;
- P10 80%;
- P11 85%;
- P12 90%;
- P13 95%.

Referência:

`SIM011-FORECAST-WEIGHTS-TEST-ONLY`

Esses pesos **não são parâmetros oficiais da Blinko** e não devem ser promovidos como padrão.

Como todas as oportunidades ativas estavam sem `estimated_value`, o primeiro resultado após configurar pesos foi R$ 0,00 — cálculo válido sobre ausência de valor estimado, e não um valor inventado.

## Valor estimado comercial auditável

A auditoria da interface mostrou que o Comercial exibia `estimated_value`, mas não possuía fluxo para registrá-lo.

Foi criada a migração 042 com a função:

`set_commercial_opportunity_estimate`

Regras:

- somente oportunidade ativa;
- somente P01–P13;
- valor maior que zero;
- data provável de fechamento opcional;
- evento comercial suportado (`note` com `note_type=estimate_changed`);
- `audit_events` específico;
- nenhuma alteração em oportunidade já encerrada.

Na primeira versão do teste, o evento novo `estimate_changed` foi recusado pela constraint existente de tipos de evento. A transação foi revertida integralmente. A função foi corrigida para reutilizar o tipo oficial `note` e registrar a semântica no payload, sem ampliar silenciosamente a constraint.

Teste final na oportunidade fictícia P07 `7236dbc9-0d72-408b-9134-f31eb79ec25f`:

- valor estimado = R$ 12.000,00;
- fechamento provável = 31/10/2026;
- peso fictício P07 = 50%;
- forecast resultante = **R$ 6.000,00**.

A tela da oportunidade passou a permitir esse registro com confirmação explícita de que estimativa não equivale a contrato, faturamento ou recebimento.

## Metas versionadas

`indicator_targets` separa meta do valor observado.

Cada versão exige:

- indicador;
- operador (`>=`, `<=`, `=`, intervalo);
- valor;
- validade opcional;
- referência/evidência;
- aprovador;
- auditoria.

Nenhuma meta oficial foi semeada pela migração.

### Prova de comparação e versionamento

Indicador: `COM_OVERDUE_FOLLOWUPS`.
Valor observado: 4.

Versão fictícia 1:

- meta `<= 3`;
- referência `SIM011-TARGET-FOLLOWUP-V1-TEST-ONLY`;
- resultado: `off_target`.

Versão fictícia 2:

- meta `<= 5`;
- referência `SIM011-TARGET-FOLLOWUP-V2-TEST-ONLY`;
- v1 foi aposentada, v2 ficou corrente;
- resultado: `on_target`.

As duas versões continuam preservadas no histórico.

## Guard de cobertura financeira

Durante a validação foi detectado um risco importante: a soma global possuía R$ 3.020,00 de custos realizados, mas R$ 420,00 pertenciam ao projeto fictício `Gráfica Aurora — SIMULAÇÃO 010`, que ainda não possui `project_financial_plan`/receita correspondente.

Sem proteção, seria possível calcular uma margem global matematicamente consistente, porém gerencialmente enganosa por misturar universos incompletos.

A migração 043 criou a cobertura financeira explícita.

Estado atual:

- custo realizado total continua visível: R$ 3.020,00;
- caixa pago continua visível: R$ 1.420,00;
- existe 1 projeto com custo realizado sem plano financeiro correspondente;
- contribuição global = `NULL / insufficient_data`;
- margem global = `NULL / insufficient_data`;
- motivo do bloqueio é mostrado na fonte segura do dashboard.

Uma meta fictícia de margem permanece armazenada/versionada, mas seu `performance_status` vira `unknown` enquanto a cobertura estiver incompleta. Meta não supera falta de dados.

## Views e estruturas principais

- `indicator_definitions`;
- `indicator_targets`;
- `indicator_parameters`;
- `current_indicator_targets`;
- `blinko_indicator_values`;
- `blinko_indicator_snapshot`;
- `blinko_indicator_snapshot_safe`;
- `blinko_financial_indicator_coverage`;
- `blinko_leads_by_source`;
- `blinko_losses_by_reason`;
- `blinko_operational_block_breakdown`;
- `blinko_finance_by_project`;
- `blinko_finance_by_company_safe`;
- `blinko_diagnostic_by_pillar`.

## Interface

Foi criada `/interno/indicadores` com:

- indicadores agrupados por Comercial, Operação, Financeiro e Diagnóstico;
- valor formatado por unidade;
- fórmula e fonte visíveis;
- estado do cálculo;
- motivo explícito quando o número não pode ser calculado;
- meta atual e performance;
- formulário de nova versão de meta;
- configuração versionada dos pesos P01–P13;
- leads por origem;
- perdas por motivo;
- bloqueios por fonte;
- rentabilidade por cliente com guard de cobertura;
- maturidade/completude por pilar.

A navegação interna recebeu a entrada `Indicadores`.

O Comercial recebeu o fluxo auditável de valor estimado/fechamento provável, necessário para alimentar o forecast sem SQL manual.

## Auditoria

Eventos confirmados na simulação:

- `indicator_target_configured`;
- `indicator_parameter_configured`;
- `commercial_opportunity_estimate_changed`;
- registro comercial `note` com `note_type=estimate_changed`.

A primeira carga manual de R$ 10.000,00 usada exclusivamente para exercitar o cálculo antes da criação do setter oficial também foi marcada em `audit_events` como `simulation_estimated_value_fixture_set` e `test_only=true`; a função oficial foi então implementada e validada com R$ 12.000,00.

## Validação de build

O código da frente passou no GitHub CI (`TypeScript` + `Next.js build`).

O Vercel do time está no plano Hobby e o status automático dos commits recentes pode aparecer como falha por `build-rate-limit`; isso é limitação de infraestrutura, não erro de compilação do pacote.

## Conclusão

A primeira camada oficial de Indicadores está estruturada com proteção contra falsa precisão:

- dado mensurável → calcula;
- dado insuficiente → informa insuficiência;
- parâmetro ausente → pede configuração;
- fonte ainda não normalizada → bloqueia;
- meta ausente → não presume desempenho;
- cobertura financeira incompleta → não calcula margem/contribuição global enganosa.

Produção/main permanece intocada. A PR #25 permanece draft até plano explícito de promoção controlada.
