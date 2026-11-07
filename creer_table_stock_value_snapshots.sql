-- ═══════════════════════════════════════════════════════════════
-- OrdiveX — Création de la table "stockValueSnapshots"
-- Nouvelle fonctionnalité : Historique de la valeur du stock.
--
-- Un instantané (date, valeur au prix d'achat, valeur au prix de vente,
-- nombre de produits en stock) est capturé automatiquement une fois par
-- jour, à la première connexion de la journée (voir js/pages/alerts-engine.js,
-- captureStockValueSnapshot).
--
-- À exécuter UNE FOIS dans l'éditeur SQL du projet Supabase de CETTE
-- pharmacie. Idempotent (CREATE TABLE IF NOT EXISTS) : sûr à ré-exécuter
-- même si la table existe déjà.
--
-- Après exécution : dans l'app, Diagnostic du poste > "Réparer la
-- synchro" (ou simplement "Récupérer les données"), pour que la table
-- soit retirée de la liste des tables absentes et que l'historique déjà
-- capturé localement soit poussé vers le serveur.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "stockValueSnapshots" (
  id              BIGINT PRIMARY KEY,
  date            TEXT NOT NULL,          -- 'YYYY-MM-DD', un instantané par jour
  "purchaseValue" NUMERIC(15,2) DEFAULT 0, -- Valeur du stock au prix d'achat
  "saleValue"     NUMERIC(15,2) DEFAULT 0, -- Valeur du stock au prix de vente
  "productCount"  BIGINT DEFAULT 0,        -- Nombre de produits en stock ce jour-là
  "updatedAt"     BIGINT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stockvaluesnapshots_date ON "stockValueSnapshots" (date);
CREATE INDEX IF NOT EXISTS idx_stockvaluesnapshots_updatedat ON "stockValueSnapshots" ("updatedAt");

ALTER TABLE "stockValueSnapshots" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stockValueSnapshots_all" ON "stockValueSnapshots";
CREATE POLICY "stockValueSnapshots_all" ON "stockValueSnapshots" FOR ALL USING (auth.role() = 'authenticated');

-- ───────────────────────────────────────────────────────────────
-- Vérification finale : confirme que la table existe bien
-- ───────────────────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'stockValueSnapshots';
