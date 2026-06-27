-- ============================================================================
-- AgriConnect Production Schema (v2.0)
-- Includes: RLS, indexes, CHECK constraints, sample data.
-- Run in Supabase SQL Editor.
-- ============================================================================

DROP TABLE IF EXISTS advisories CASCADE;
DROP TABLE IF EXISTS diseases CASCADE;
DROP TABLE IF EXISTS pests CASCADE;
DROP TABLE IF EXISTS crops CASCADE;
DROP TABLE IF EXISTS farmers CASCADE;

-- ----------------------------------------------------------------------------
-- FARMERS
-- ----------------------------------------------------------------------------
CREATE TABLE farmers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      TEXT UNIQUE NOT NULL CHECK (phone ~ '^\+\d{10,15}$'),
  name       TEXT,
  region     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_farmers_phone ON farmers(phone);

-- ----------------------------------------------------------------------------
-- CROPS / PESTS / DISEASES
-- ----------------------------------------------------------------------------
CREATE TABLE crops (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_crops_name ON crops(name);

CREATE TABLE pests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  common_name TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_pests_name ON pests(name);

CREATE TABLE diseases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  common_name TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_diseases_name ON diseases(name);

-- ----------------------------------------------------------------------------
-- ADVISORIES
-- ----------------------------------------------------------------------------
CREATE TABLE advisories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id   UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  query       TEXT NOT NULL CHECK (LENGTH(query) > 0 AND LENGTH(query) <= 1000),
  response    TEXT NOT NULL CHECK (LENGTH(response) > 0),
  crop_id     UUID REFERENCES crops(id) ON DELETE SET NULL,
  pest_id     UUID REFERENCES pests(id) ON DELETE SET NULL,
  disease_id  UUID REFERENCES diseases(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_advisories_farmer_id  ON advisories(farmer_id);
CREATE INDEX idx_advisories_created_at ON advisories(created_at DESC);
CREATE INDEX idx_advisories_pest_id    ON advisories(pest_id);
CREATE INDEX idx_advisories_crop_id    ON advisories(crop_id);

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
ALTER TABLE farmers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE crops      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE diseases   ENABLE ROW LEVEL SECURITY;
ALTER TABLE advisories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "farmers_select_all"    ON farmers    FOR SELECT USING (true);
CREATE POLICY "farmers_insert_all"    ON farmers    FOR INSERT WITH CHECK (true);
CREATE POLICY "farmers_update_all"    ON farmers    FOR UPDATE USING (true);

CREATE POLICY "crops_select_all"      ON crops      FOR SELECT USING (true);
CREATE POLICY "crops_insert_all"      ON crops      FOR INSERT WITH CHECK (true);
CREATE POLICY "crops_update_all"      ON crops      FOR UPDATE USING (true);

CREATE POLICY "pests_select_all"      ON pests      FOR SELECT USING (true);
CREATE POLICY "pests_insert_all"      ON pests      FOR INSERT WITH CHECK (true);
CREATE POLICY "pests_update_all"      ON pests      FOR UPDATE USING (true);

CREATE POLICY "diseases_select_all"   ON diseases   FOR SELECT USING (true);
CREATE POLICY "diseases_insert_all"   ON diseases   FOR INSERT WITH CHECK (true);
CREATE POLICY "diseases_update_all"   ON diseases   FOR UPDATE USING (true);

CREATE POLICY "advisories_select_all" ON advisories FOR SELECT USING (true);
CREATE POLICY "advisories_insert_all" ON advisories FOR INSERT WITH CHECK (true);
CREATE POLICY "advisories_update_all" ON advisories FOR UPDATE USING (true);

-- ----------------------------------------------------------------------------
-- GRANTS
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON farmers    TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON crops      TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON pests      TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON diseases   TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON advisories TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- SAMPLE DATA
-- ----------------------------------------------------------------------------
INSERT INTO farmers (phone, name, region) VALUES
  ('+256712345678', 'Daudi',  'Eastern Uganda'),
  ('+256787654321', 'Kabira', 'Western Uganda')
ON CONFLICT DO NOTHING;

INSERT INTO crops (name) VALUES
  ('Maize'), ('Cassava'), ('Beans'), ('Banana'), ('Coffee'), ('Rice'), ('Millet')
ON CONFLICT DO NOTHING;

INSERT INTO pests (name, common_name) VALUES
  ('Fall Armyworm', 'Armyworm'),
  ('Whitefly',      'White Fly'),
  ('Aphid',         'Aphids'),
  ('Stem Borer',    'Stem Borer')
ON CONFLICT DO NOTHING;

INSERT INTO diseases (name, common_name) VALUES
  ('Cassava Mosaic Virus', 'Mosaic'),
  ('Banana Wilt',          'Wilt'),
  ('Maize Blight',         'Blight')
ON CONFLICT DO NOTHING;