# Blinko OS v1 — Pré-flight de produção

Data: 11/09/2026  
Escopo: preparação para eventual promoção das migrações `012`–`048`  
Branch de código candidata: `feat/blinko-os-v1-audit`  
Estado: **PRÉ-FLIGHT SOMENTE LEITURA — NÃO AUTORIZA PRODUÇÃO**

## 1. Resultado executivo

Classificação atual:

- **Ensaio em branch temporária derivada da produção: GO**
- **Promoção real em produção: NO-GO neste momento**

O banco principal permanece no baseline legado esperado e não recebeu automaticamente as migrações do Blinko OS v1.

## 2. Baseline confirmado

Neon projeto: `steep-meadow-86591499`  
Branch principal: `main` (`br-raspy-snow-aw6jcjdt`)  
Branch de simulação: `blinko-os-v1-sim` (`br-soft-violet-aw0lfbud`)

O inventário do schema de produção confirmou estruturas do baseline `001`–`011` e ausência de marcadores estruturais das migrações `012`–`048`.

No GitHub `main`, o diretório `neon/sql` também contém o baseline legado até `011` como conjunto já incorporado à linha principal.

Conclusão: o delta `012`–`048` é **planejado**; não foi identificado drift clandestino dessas migrações em produção.

## 3. Volume de dados legado

Contagens observadas no Neon `main` durante o pré-flight:

- Empresas: **1**
- Leads: **1**
- Pré-diagnósticos: **1**
- Projetos: **0**
- Propostas: **0**
- Diagnósticos: **0**
- Tarefas de projeto: **0**

O único Lead observado permanece no status legado `reviewing`.

Não existe hoje estoque de projetos, propostas, contratos, diagnósticos ou tarefas que exija backfill massivo para satisfazer os novos gates.

## 4. Preservação de registros herdados

Na branch `blinko-os-v1-sim`, que foi derivada do `main` antes da aplicação de `012`–`048`, os registros herdados continuam presentes após a evolução de schema:

- Empresas herdadas: **1**
- Leads herdados: **1**
- Pré-diagnósticos herdados: **1**
- Projetos herdados: **0**
- Propostas herdadas: **0**
- Diagnósticos herdados: **0**

Isso fornece evidência inicial de que a sequência de migrações não eliminou o fluxo legado existente.

## 5. Código candidato

Checkpoint observado no início deste pré-flight:

- branch: `feat/blinko-os-v1-audit`
- commit: `f367237f1076d797a3c406a7ec795b513c94b48e`
- GitHub Actions / Blinko CI #374: **success**
- TypeScript: **success**
- Next.js build: **success**

O status Vercel do mesmo commit não representa falha de compilação: o deployment foi recusado por `build-rate-limit` do plano, com mensagem `Deployment rate limited — retry in 24 hours.`

Consequência: o código tem CI verde, mas o Preview Vercel do checkpoint ainda **não foi validado**.

## 6. Recuperação e proteção — bloqueadores atuais

Foram encontrados bloqueadores para promoção real:

1. O Neon `main` não possui snapshot agendado no momento do pré-flight.
2. O projeto Neon informa `history_retention_seconds = 21600` — aproximadamente **6 horas** de retenção histórica.
3. A branch Neon `main` está marcada como `protected = false`.
4. A branch GitHub `main` também aparece sem proteção de branch / required status checks.
5. O Preview Vercel do commit candidato não foi executado por limitação externa de quota.

Esses itens não impedem o ensaio em uma branch temporária, mas mantêm o estado de produção como **NO-GO**.

## 7. Compatibilidade detectada no pré-flight

O schema legado `001`–`011` possui diferenças naturais de nomenclatura e tipos em relação às estruturas novas. Duas consultas agregadas de inspeção precisaram ser ajustadas porque presumiam nomes/tipos de colunas posteriores.

Nenhuma dessas consultas alterou dados; ambas eram `SELECT` e foram rejeitadas antes de produzir efeito.

Interpretação: o ensaio precisa usar o schema legado real como origem e nunca presumir que estruturas de 012+ já existem.

## 8. Critérios para o ensaio

O ensaio deve:

1. nascer de uma branch Neon temporária derivada do `main` atual;
2. aplicar `012`→`048` na ordem numérica;
3. parar no primeiro erro de migração;
4. não corrigir produção para fazer o ensaio passar;
5. validar preservação do Lead/Empresa/pré-diagnóstico herdados;
6. executar smoke tests críticos de RBAC, Comercial, Diagnóstico, Projeto, Parceiros/Financeiro e Recorrência;
7. registrar qualquer incompatibilidade como forward-fix em nova migração, nunca como edição silenciosa do histórico;
8. excluir qualquer fixture real de cliente; cenários adicionais devem ser fictícios.

## 9. Critérios que continuam bloqueando produção

Promoção real continua proibida enquanto pelo menos um dos itens abaixo permanecer:

- caminho de restauração deliberado ainda não verificado;
- proteção operacional do banco principal inadequada;
- branch principal de código sem proteção adequada;
- ensaio completo 012–048 sobre clone atual da produção ainda não concluído;
- Preview/deployment candidato não validado;
- bootstrap do primeiro Admin individual não ensaiado sobre clone atual da produção.

## 10. Próximo passo autorizado por este documento

**Criar uma branch temporária derivada do Neon `main` e executar o ensaio completo `012`–`048`.**

Este documento não autoriza merge da PR, aplicação de DDL no Neon `main`, promoção Vercel de produção ou mudança de credenciais/usuários reais.
