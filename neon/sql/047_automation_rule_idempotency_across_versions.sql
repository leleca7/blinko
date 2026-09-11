-- Blinko OS — Idempotência de automação atravessando versões
-- Complementa 046 após Simulação 013.
-- Regra: a mesma chave lógica de evento não pode ser executada novamente apenas porque a regra ganhou uma nova versão.
-- Produção/main não deve receber esta migração sem promoção controlada.

create unique index if not exists automation_rule_executions_rule_key_uidx
  on public.automation_rule_executions(rule_id,idempotency_key);
