-- Blinko OS · Comercial gráfico · MVP
-- Estrutura isolada para fornecedores, catálogo, solicitações, orçamentos, pedidos, contratos e financeiro.

create table if not exists public.graphic_suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  contact_name text,
  whatsapp text,
  email text,
  active boolean not null default true,
  default_blinko_share_pct numeric(5,2) not null default 50,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.graphic_product_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.graphic_products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.graphic_product_categories(id) on delete set null,
  supplier_id uuid references public.graphic_suppliers(id) on delete set null,
  sku text unique,
  name text not null,
  description text,
  active boolean not null default true,
  requires_dimensions boolean not null default false,
  requires_quantity boolean not null default true,
  base_lead_time_days integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.graphic_product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.graphic_products(id) on delete cascade,
  label text not null,
  material text,
  grammage text,
  width_mm numeric(10,2),
  height_mm numeric(10,2),
  print_sides text,
  finishing text,
  min_quantity integer,
  quantity_step integer,
  production_cost numeric(12,2),
  suggested_price numeric(12,2),
  lead_time_days integer,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.graphic_requests (
  id uuid primary key default gen_random_uuid(),
  display_code text unique,
  company_id uuid references public.companies(id) on delete set null,
  source_lead_id uuid references public.leads(id) on delete set null,
  status text not null default 'new',
  lead_source text not null default 'site',
  requester_name text not null,
  business_name text,
  document_number text,
  whatsapp text not null,
  email text,
  city_state text,
  art_status text not null default 'ready',
  needed_by date,
  delivery_method text,
  delivery_address text,
  reference_url text,
  notes text,
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.graphic_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.graphic_requests(id) on delete cascade,
  product_id uuid references public.graphic_products(id) on delete set null,
  category_slug text,
  product_label text not null,
  quantity integer,
  width_mm numeric(10,2),
  height_mm numeric(10,2),
  material text,
  finishing text,
  description text,
  file_url text,
  supplier_id uuid references public.graphic_suppliers(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.graphic_quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.graphic_requests(id) on delete cascade,
  supplier_id uuid references public.graphic_suppliers(id) on delete set null,
  display_code text unique,
  status text not null default 'draft',
  valid_until date,
  production_cost numeric(12,2) not null default 0,
  freight_cost numeric(12,2) not null default 0,
  other_costs numeric(12,2) not null default 0,
  sale_price numeric(12,2) not null default 0,
  blinko_share_pct numeric(5,2) not null default 50,
  blinko_share_amount numeric(12,2) not null default 0,
  supplier_share_amount numeric(12,2) not null default 0,
  internal_notes text,
  client_notes text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  approved_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.graphic_orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.graphic_requests(id) on delete restrict,
  quote_id uuid references public.graphic_quotes(id) on delete set null,
  display_code text unique,
  status text not null default 'approved',
  payment_status text not null default 'pending',
  production_status text not null default 'pending',
  delivery_status text not null default 'pending',
  final_price numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.graphic_contracts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.graphic_orders(id) on delete cascade,
  display_code text unique,
  template_type text not null,
  status text not null default 'draft',
  snapshot jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  sent_at timestamptz,
  accepted_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.graphic_financial_entries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.graphic_orders(id) on delete cascade,
  quote_id uuid references public.graphic_quotes(id) on delete set null,
  entry_type text not null,
  party text,
  amount numeric(12,2) not null,
  status text not null default 'pending',
  due_date date,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists graphic_requests_status_created_idx on public.graphic_requests(status, created_at desc);
create index if not exists graphic_quotes_request_idx on public.graphic_quotes(request_id, created_at desc);
create index if not exists graphic_orders_status_created_idx on public.graphic_orders(status, created_at desc);

insert into public.graphic_product_categories (slug, name, sort_order) values
  ('cartoes', 'Cartões de visita', 10),
  ('panfletos-folders', 'Panfletos e folders', 20),
  ('adesivos', 'Adesivos', 30),
  ('banners', 'Banners e wind banners', 40),
  ('fachadas-vitrines', 'Fachadas e vitrines', 50),
  ('sacolas-embalagens', 'Sacolas e embalagens', 60),
  ('delivery', 'Materiais para delivery', 70),
  ('eventos', 'Credenciais e eventos', 80),
  ('personalizados', 'Personalizados', 90),
  ('outro', 'Outro', 100)
on conflict (slug) do nothing;
