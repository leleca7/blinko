# Ativação Neon + Vercel — Blinko

## Estado atual

- Projeto Neon: `blinko`
- Project ID: `steep-meadow-86591499`
- Branch principal: `main`
- Database: `neondb`
- Schema Core V1 aplicado e validado na `main`.
- 7 funções Core V1 aplicadas.
- Branch temporária de teste removida após validação.

## Variável necessária no Vercel

Criar a variável de ambiente server-only:

`DATABASE_URL`

Use a connection string **pooled** do Neon para o branch `main`, database `neondb`.

Não use prefixo `NEXT_PUBLIC_` e não compartilhe o valor em chat, issue, commit ou screenshot público.

## Ambientes

Aplicar `DATABASE_URL` pelo menos em:

- Preview
- Production

Opcionalmente também Development, se for usar `vercel env pull` localmente.

## Depois de configurar

1. disparar/redeploy do branch `feat/pre-diagnostico-v1`;
2. abrir `/diagnostico` no preview;
3. enviar uma submissão claramente marcada como teste;
4. conferir no Neon Lead + Pré-Diagnóstico + ação + audit event;
5. só considerar merge após a integração end-to-end passar.
