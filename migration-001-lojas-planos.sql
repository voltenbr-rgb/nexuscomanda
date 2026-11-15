-- Rode UMA vez no banco que já existe:
--   npx wrangler d1 execute nexus --remote --file=./migration-001-lojas-planos.sql
ALTER TABLE tenants ADD COLUMN auto_renew INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tenants ADD COLUMN card_last4 TEXT;
ALTER TABLE plans ADD COLUMN max_stores INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tenant_records ADD COLUMN store_id TEXT;

CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_stores_tenant ON stores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_records_store ON tenant_records(store_id);

-- Planos fictícios: Básico R$1 (2 lojas), Completo R$2 (3 lojas), Prêmio R$3 (5 lojas)
INSERT OR IGNORE INTO plans(id,name,description,price_cents,interval_days,max_stores,features_json) VALUES
 ('starter','Plano Básico','Plano de teste (fictício)',100,30,2,'["Até 2 lojas","Agendamentos","Clientes"]'),
 ('pro','Plano Completo','Plano de teste (fictício)',200,30,3,'["Até 3 lojas","Tudo do Básico","Financeiro"]'),
 ('business','Plano Prêmio','Plano de teste (fictício)',300,30,5,'["Até 5 lojas","Tudo do Completo","Suporte prioritário"]');
UPDATE plans SET name='Plano Básico',description='Plano de teste (fictício)',price_cents=100,max_stores=2,features_json='["Até 2 lojas","Agendamentos","Clientes"]' WHERE id='starter';
UPDATE plans SET name='Plano Completo',description='Plano de teste (fictício)',price_cents=200,max_stores=3,features_json='["Até 3 lojas","Tudo do Básico","Financeiro"]' WHERE id='pro';
UPDATE plans SET name='Plano Prêmio',description='Plano de teste (fictício)',price_cents=300,max_stores=5,features_json='["Até 5 lojas","Tudo do Completo","Suporte prioritário"]' WHERE id='business';
