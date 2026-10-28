CREATE TABLE IF NOT EXISTS avinor_statuses (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_system BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS avinor_client_status (
  cliente_id BIGINT PRIMARY KEY,
  status_id TEXT REFERENCES avinor_statuses(id),
  data_atendimento DATE,
  observacoes TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  recontato BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS avinor_import_logs (
  id BIGSERIAL PRIMARY KEY,
  filename TEXT,
  rows_imported INT,
  mapping JSONB,
  imported_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS avinor_db_configs (
  id SERIAL PRIMARY KEY,
  kind TEXT CHECK (kind IN ('mysql', 'neon')),
  config JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS avinor_extra_attendances (
  id SERIAL PRIMARY KEY,
  cliente_id BIGINT NOT NULL,
  dia DATE NOT NULL,
  vendedor_id INT NOT NULL,
  added_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (cliente_id, dia)
);

CREATE TABLE IF NOT EXISTS avinor_column_mappings (
  id SERIAL PRIMARY KEY,
  signature TEXT UNIQUE NOT NULL,
  headers JSONB,
  mapping JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);
