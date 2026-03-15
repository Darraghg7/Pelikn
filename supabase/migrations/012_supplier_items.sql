-- ============================================================================
-- 012: Supplier item catalog for smart delivery checks
-- ============================================================================

-- ── Suppliers ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  is_active  boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers (lower(name));

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS suppliers_read  ON suppliers;
DROP POLICY IF EXISTS suppliers_write ON suppliers;
CREATE POLICY suppliers_read  ON suppliers FOR SELECT USING (true);
CREATE POLICY suppliers_write ON suppliers FOR ALL    USING (true) WITH CHECK (true);

-- ── Supplier items (the catalog) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name          text NOT NULL,
  category      text NOT NULL DEFAULT 'ambient',   -- chilled | frozen | ambient | dry
  temp_required boolean DEFAULT false,
  min_temp      numeric(4,1),                      -- acceptable range for chilled/frozen
  max_temp      numeric(4,1),
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE supplier_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS supplier_items_read  ON supplier_items;
DROP POLICY IF EXISTS supplier_items_write ON supplier_items;
CREATE POLICY supplier_items_read  ON supplier_items FOR SELECT USING (true);
CREATE POLICY supplier_items_write ON supplier_items FOR ALL    USING (true) WITH CHECK (true);

-- ── Delivery check items (line items per delivery) ──────────────────────────
CREATE TABLE IF NOT EXISTS delivery_check_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_check_id uuid NOT NULL REFERENCES delivery_checks(id) ON DELETE CASCADE,
  supplier_item_id  uuid REFERENCES supplier_items(id),
  item_name         text NOT NULL,
  received          boolean DEFAULT true,
  temp_reading      numeric(4,1),
  temp_pass         boolean DEFAULT true,
  notes             text,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE delivery_check_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS delivery_check_items_read  ON delivery_check_items;
DROP POLICY IF EXISTS delivery_check_items_write ON delivery_check_items;
CREATE POLICY delivery_check_items_read  ON delivery_check_items FOR SELECT USING (true);
CREATE POLICY delivery_check_items_write ON delivery_check_items FOR ALL    USING (true) WITH CHECK (true);

-- ── Add supplier_id to delivery_checks ──────────────────────────────────────
ALTER TABLE delivery_checks ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id);
