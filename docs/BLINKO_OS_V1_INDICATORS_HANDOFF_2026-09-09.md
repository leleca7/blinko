# Blinko OS v1 — checkpoint Indicadores · 09/09/2026

Branch: `feat/blinko-os-v1-audit`
Neon de validação: `blinko-os-v1-sim` (`br-soft-violet-aw0lfbud`)
Produção/main: **não alterada**

## Estado concluído

A frente de Indicadores e Metas foi estruturada nas migrações 041–043 e validada na Simulação 011.

Arquivos principais:

- `neon/sql/041_indicators_targets_financial_settings.sql`
- `neon/sql/042_commercial_estimate_for_forecast.sql`
- `neon/sql/043_indicator_financial_coverage_guard.sql`
- `lib/blinko/indicators-server.ts`
- `app/interno/indicadores/page.tsx`
- `app/api/interno/indicadores/target/route.ts`
- `app/api/interno/indicadores/forecast-weights/route.ts`
- `app/api/interno/comercial/[id]/estimate/route.ts`
- `app/interno/comercial/[id]/page.tsx`
- `docs/BLINKO_OS_V1_SIMULATION_011_INDICATORS.md`

## Invariantes preservados

- meta não é valor observado;
- ausência de meta não significa fora/na meta;
- ausência de parâmetro não vira default;
- `NULL` não é exibido como zero;
- fonte não normalizada não gera cálculo aproximado;
- contribuição/margem global ficam bloqueadas quando existem custos realizados em projetos sem plano financeiro correspondente;
- forecast só utiliza valores estimados explicitamente registrados e pesos P01–P13 explicitamente configurados;
- pesos e metas da Simulação 011 são **fixtures de teste**, não parâmetros oficiais da Blinko.

## Estado final da Simulação 011

- 38 indicadores catalogados;
- 30 calculáveis no conjunto atual de fixtures;
- 3 com dados insuficientes;
- 5 com fonte ainda não normalizada;
- forecast fictício final: R$ 6.000,00;
- 4 follow-ups vencidos;
- meta fictícia corrente de follow-ups `<=5` → `on_target`;
- 1 projeto com custo realizado sem plano financeiro correspondente;
- custo realizado sem cobertura de plano: R$ 420,00;
- por isso contribuição e margem globais ficam sem valor e sem comparação de meta.

## Validação técnica

HEAD de código antes deste checkpoint: `ce00533aff7fe8f7c999087a6b8c78fe519aa99d`.

GitHub CI correspondente: `success` em TypeScript e Next.js build.

Vercel: commits recentes podem aparecer como falha por `build-rate-limit` do plano Hobby do time. Isso não representa falha de compilação da aplicação.

## Próxima continuidade sugerida

Seguir o roadmap oficial restante sem abrir automações precoces:

1. permissões/papéis internos e configurações governadas além das metas;
2. renovação, reavaliação e continuidade pós-projeto;
3. fechar fontes ainda não normalizadas dos indicadores somente quando as respectivas entidades existirem;
4. depois preparar plano explícito de promoção das migrações da branch de simulação para ambiente principal.
