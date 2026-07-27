-- ═══════════════════════════════════════════════════════════════
-- MIGRATION : File de préparation → Caisse
-- Table "prep_transfers" — ventes préparées transférées à un caissier
-- (potentiellement sur un autre poste), pour encaissement.
--
-- À exécuter UNE FOIS dans l'éditeur SQL de votre projet Supabase.
-- Idempotent : peut être ré-exécuté sans erreur si déjà appliqué.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "prep_transfers" (
  id              BIGINT PRIMARY KEY,
  items           JSONB,
  "patientId"     BIGINT,
  "patientName"   TEXT,
  rx              JSONB,
  "preparerId"    BIGINT,
  "preparerName"  TEXT,
  "deviceId"      TEXT,
  "itemCount"     INTEGER DEFAULT 0,
  total           NUMERIC DEFAULT 0,
  status          TEXT DEFAULT 'pending', -- 'pending' | 'claimed' | 'completed' | 'cancelled'
  "claimedBy"     BIGINT,
  "claimedByName" TEXT,
  "claimedAt"     BIGINT,
  "completedAt"   BIGINT,
  "createdAt"     BIGINT,
  "updatedAt"     BIGINT
);

ALTER TABLE "prep_transfers" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prep_transfers_policy_select" ON "prep_transfers";
DROP POLICY IF EXISTS "prep_transfers_policy_insert" ON "prep_transfers";
DROP POLICY IF EXISTS "prep_transfers_policy_update" ON "prep_transfers";
DROP POLICY IF EXISTS "prep_transfers_policy_delete" ON "prep_transfers";

CREATE POLICY "prep_transfers_policy_select" ON "prep_transfers" FOR SELECT USING (true);
CREATE POLICY "prep_transfers_policy_insert" ON "prep_transfers" FOR INSERT WITH CHECK (true);
CREATE POLICY "prep_transfers_policy_update" ON "prep_transfers" FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "prep_transfers_policy_delete" ON "prep_transfers" FOR DELETE USING (true);

-- Activer le temps réel (notification quasi-instantanée entre postes) —
-- ignore l'erreur si la table est déjà dans la publication.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "prep_transfers";
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
