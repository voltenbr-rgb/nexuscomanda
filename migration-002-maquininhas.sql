-- Maquininhas de cartão físicas (Mercado Pago Point, Stone, Ton) por loja.
-- Opcional: o schema.js já cria estas tabelas sozinho no primeiro acesso à API.
-- Para criar manualmente, rode UMA vez:
--   npx wrangler d1 execute nexus --remote --file=./migration-002-maquininhas.sql
--
-- A loja segue o mesmo padrão de store_links: conta (tenant_id) + número da loja (loja = 1..10).
-- As credenciais ficam CIFRADAS (AES-GCM) em credentials_enc; nunca são devolvidas ao navegador.

CREATE TABLE IF NOT EXISTS store_payment_terminals (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  loja INTEGER NOT NULL DEFAULT 1,
  provider TEXT NOT NULL,                 -- mercadopago_point | stone | ton
  credentials_enc TEXT NOT NULL,          -- JSON cifrado: access_token, client_id, api_key, stone_code...
  credentials_hint TEXT,                  -- JSON público: campos não secretos + final dos secretos (ex.: "••••1a2b")
  device_id TEXT NOT NULL,                -- terminal_id / serial da maquininha física
  device_label TEXT,                      -- apelido opcional (ex.: "Balcão 1")
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, loja)
);

CREATE TABLE IF NOT EXISTS terminal_charges (
  id TEXT PRIMARY KEY,                    -- também usado como external_reference e X-Idempotency-Key
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  loja INTEGER NOT NULL DEFAULT 1,
  provider TEXT NOT NULL,
  device_id TEXT NOT NULL,
  external_id TEXT,                       -- id da order/cobrança no gateway
  amount_cents INTEGER NOT NULL,
  method TEXT NOT NULL,                   -- credito | debito
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | canceled | error
  status_detail TEXT,
  provider_status TEXT,                   -- status bruto devolvido pelo gateway
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_terminal_charges_tl ON terminal_charges(tenant_id, loja, created_at);
