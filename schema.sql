PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  business_name TEXT NOT NULL,
  segment TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  theme_mode TEXT NOT NULL DEFAULT 'dark' CHECK(theme_mode IN ('dark','light')),
  color_palette TEXT NOT NULL DEFAULT 'violet',
  custom_color TEXT,
  panel_model_id TEXT NOT NULL DEFAULT 'barber-pro',
  plan_id TEXT,
  status TEXT NOT NULL DEFAULT 'trial' CHECK(status IN ('active','trial','expired','suspended')),
  trial_expires_at TEXT,
  license_expires_at TEXT,
  auto_renew INTEGER NOT NULL DEFAULT 0,
  card_last4 TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  interval_days INTEGER NOT NULL DEFAULT 30,
  max_stores INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  features_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  provider TEXT NOT NULL DEFAULT 'simulated',
  payment_method TEXT NOT NULL CHECK(payment_method IN ('pix','card')),
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','paid','failed','refunded')),
  external_reference TEXT,
  pix_copy_paste TEXT,
  card_last4 TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS master_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_stores_tenant ON stores(tenant_id);

CREATE TABLE IF NOT EXISTS tenant_records (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  store_id TEXT,
  record_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_records_tenant_type ON tenant_records(tenant_id, record_type);
CREATE INDEX IF NOT EXISTS idx_records_store ON tenant_records(store_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant ON transactions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

CREATE TABLE IF NOT EXISTS auth_attempts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  attempted_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_email_time ON auth_attempts(email, attempted_at);

INSERT OR IGNORE INTO plans(id,name,description,price_cents,interval_days,max_stores,features_json)
VALUES
 ('starter','Plano Básico','Plano de teste (fictício)',100,30,2,'["Até 2 lojas","Agendamentos","Clientes"]'),
 ('pro','Plano Completo','Plano de teste (fictício)',200,30,3,'["Até 3 lojas","Tudo do Básico","Financeiro"]'),
 ('business','Plano Prêmio','Plano de teste (fictício)',300,30,5,'["Até 5 lojas","Tudo do Completo","Suporte prioritário"]');
