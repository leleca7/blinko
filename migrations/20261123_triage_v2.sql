-- BLINKO · Triagem rápida V2 · versão de prévia
-- NÃO aplicar em produção antes de revisar escopo, acesso, retenção e integração.
-- Neon/PostgreSQL — dados coletados somente após consentimento explícito.

CREATE TABLE IF NOT EXISTS public.blinko_triage_v2 (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  whatsapp_link_opened_at timestamptz,
  stage smallint NOT NULL DEFAULT 1 CHECK (stage BETWEEN 1 AND 3),
  status text NOT NULL DEFAULT 'started'
    CHECK (status IN ('started', 'submitted')),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  company_name text NOT NULL DEFAULT '',
  whatsapp text NOT NULL,
  email text NOT NULL DEFAULT '',
  request_kind text NOT NULL DEFAULT '',
  challenge text NOT NULL DEFAULT '',
  timeframe text NOT NULL DEFAULT '',
  preferred_channel text NOT NULL DEFAULT '',
  consent_version text NOT NULL DEFAULT 'triage-v2-contact-consent-2026-11-23',
  consent_at timestamptz NOT NULL DEFAULT now(),
  source_page text NOT NULL DEFAULT '/diagnostico',
  CHECK (char_length(company_name) <= 140),
  CHECK (char_length(email) <= 180),
  CHECK (char_length(whatsapp) BETWEEN 10 AND 30),
  CHECK (char_length(challenge) <= 650),
  CHECK (char_length(request_kind) <= 32),
  CHECK (char_length(timeframe) <= 32),
  CHECK (char_length(preferred_channel) <= 32)
);
CREATE INDEX IF NOT EXISTS idx_blinko_triage_v2_updated_at ON public.blinko_triage_v2(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_blinko_triage_v2_status ON public.blinko_triage_v2(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_blinko_triage_v2_email ON public.blinko_triage_v2(lower(email)) WHERE email <> '';

-- Não criar GRANT para usuário anônimo/public; leitura e escrita ocorrem
-- exclusivamente pelo serviço server-side autenticado via DATABASE_URL.
-- STATUS: started + updated_at < now()-interval '24 hours' = abandono provável,
-- NÃO prova de que uma pessoa tenha desistido definitivamente.
-- Abrir o link do WhatsApp não confirma envio ou entrega de mensagem.
