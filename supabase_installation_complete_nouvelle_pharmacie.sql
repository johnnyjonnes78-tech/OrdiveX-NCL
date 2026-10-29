-- ═══════════════════════════════════════════════════════════════════════════════
-- OrdiveX — INSTALLATION COMPLÈTE EN UN SEUL SCRIPT (nouvelle pharmacie)
--
-- Ce fichier est la fusion, dans l'ordre, de :
--   1. supabase_schema.sql                         (schéma principal)
--   2. supabase_nouvelle_pharmacie_complements.sql (compléments : prep_transfers,
--      colonnes invoices/saleItems/cashRegister/app_users/sales manquantes)
--
-- Objectif : exécuter UN SEUL script (au lieu de deux, dans l'ordre) dans le SQL
-- Editor d'un projet Supabase TOUT NEUF, pour une pharmacie qui n'a encore jamais
-- été installée. Les deux fichiers sources ci-dessus restent inchangés et à jour
-- séparément — ce fichier est régénéré à partir d'eux, il ne doit jamais être édité
-- à la main : si l'un des deux fichiers sources change, refusionnez-les ici.
--
-- ⚠️ Comme supabase_schema.sql, ce script commence par des DROP TABLE ... CASCADE
-- (voir section 0 ci-dessous) — à n'exécuter QUE sur un projet Supabase neuf et
-- VIDE. Ne jamais le relancer sur un projet contenant déjà des données réelles
-- d'une pharmacie en activité : ça les supprimerait. Pour une pharmacie déjà en
-- place, voir plutôt la section "Pharmacie déjà en place avant le 29/10/2026 ?"
-- du fichier GUIDE_INSTALLATION_NOUVELLE_PHARMACIE.md (scripts de réparation
-- ajout_colonnes_paiement_facture_categorie_caisse.sql puis
-- ajout_colonnes_sales_dettes_assurance.sql).
--
-- Après exécution : Authentication → Sign In / Providers → activer "Anonymous
-- Sign-Ins" (étape 3 du guide), puis continuer à l'étape 4 du guide
-- (URL + clé API) — ce script ne couvre que la partie base de données.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTIE 1/2 — supabase_schema.sql (contenu intégral, inchangé)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ============================================================
-- PHARMA_PROJET v3.2.1 — Schéma Supabase COMPLET (STABLE)
-- 
-- DESCRIPTION :
-- Ce fichier contient la structure complète de la base de données 
-- Supabase pour PharmaProjet. Il inclut toutes les tables, 
-- types de données et politiques de sécurité (RLS).
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- 0. NETTOYAGE — Supprime les tables existantes (ordre = dépendances)
-- ═══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS "cashRegister" CASCADE;
DROP TABLE IF EXISTS "auditLog" CASCADE;
DROP TABLE IF EXISTS "app_users" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TABLE IF EXISTS "returns" CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS "saleItems" CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS movements CASCADE;
DROP TABLE IF EXISTS stock CASCADE;
DROP TABLE IF EXISTS lots CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS "purchaseOrders" CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS prescriptions CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- 1. TABLE PRODUCTS — Catalogue des médicaments
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE products (
  id                      BIGINT PRIMARY KEY,
  code                    TEXT,
  name                    TEXT,
  dci                     TEXT,
  brand                   TEXT,
  form                    TEXT,
  dosage                  TEXT,
  category                TEXT,
  "requiresPrescription"  BOOLEAN DEFAULT false,
  "minStock"              INTEGER DEFAULT 10,
  "salePrice"             NUMERIC DEFAULT 0,
  "purchasePrice"         NUMERIC DEFAULT 0,
  "vatRate"               NUMERIC DEFAULT 0,
  unit                    TEXT DEFAULT 'boîte',
  status                  TEXT DEFAULT 'active',
  "expiryDate"            TEXT,
  -- ═══ NOTICE MÉDICALE (Feature 4) ═══
  "dosageInstructions"    TEXT,
  "precautions"           TEXT,
  "contraindications"     TEXT,
  "sideEffects"           TEXT,
  "medicalNotice"         TEXT,
  -- ═══ DÉCONDITIONNEMENT (Feature 1) ═══
  "unitsPerBox"           INTEGER DEFAULT 1,
  "pricePerUnit"          NUMERIC DEFAULT 0,
  "allowUnitSale"         BOOLEAN DEFAULT false,
  "notices"               TEXT,
  "interactions"          TEXT,
  "dosageForm"            TEXT,
  "costPrice"             NUMERIC,
  "hasLots"               BOOLEAN,
  "sellPrice"             NUMERIC,
  "subUnitsPerBox"        INTEGER,
  "pricePerSubUnit"       NUMERIC,
  "isControlled"          BOOLEAN,
  "controlledClass"       TEXT,
  "manufacturer"          TEXT,
  "noticePdfUrl"          TEXT,
  "updatedAt"             BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 2. TABLE LOTS — Gestion des lots
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE lots (
  id                      BIGINT PRIMARY KEY,
  "productId"             BIGINT,
  "lotNumber"             TEXT,
  "expiryDate"            TEXT,
  quantity                INTEGER DEFAULT 0,
  "initialQuantity"       INTEGER DEFAULT 0,
  "supplierId"            BIGINT,
  "receiptDate"           TEXT,
  status                  TEXT DEFAULT 'active',
  "updatedAt"             BIGINT,
  "destroyedQty"          INTEGER DEFAULT 0,
  "destructionDate"       TEXT,
  "destructionReason"     TEXT,
  "destructionMethod"     TEXT,
  "destructionWitnesses"  TEXT,
  "destructionBy"         TEXT,
  "invoiceId"             BIGINT,
  "invoiceRef"            TEXT,
  "productionDate"        TEXT,
  "manufactureDate"       TEXT,
  supplier                TEXT,
  location                TEXT DEFAULT 'rayon',
  "createdAt"             BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 3. TABLE STOCK — État du stock par produit
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE stock (
  id                  BIGINT PRIMARY KEY,
  "productId"         BIGINT,
  quantity            INTEGER DEFAULT 0,
  "reservedQuantity"  INTEGER DEFAULT 0,
  "lastUpdated"       BIGINT,
  "lastUpdate"        TEXT,
  "minQuantity"       INTEGER,
  "updatedAt"         BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 4. TABLE MOVEMENTS — Historique des mouvements
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE movements (
  id            BIGINT PRIMARY KEY,
  "productId"   BIGINT,
  type          TEXT,
  "subType"     TEXT,
  quantity      INTEGER DEFAULT 0,
  "lotNumber"   TEXT,
  date          TEXT,
  "userId"      BIGINT,
  note          TEXT,
  reference     TEXT,
  "invoiceRef"  TEXT,
  "updatedAt"   BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 5. TABLE SUPPLIERS — Fournisseurs
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE suppliers (
  id              BIGINT PRIMARY KEY,
  name            TEXT,
  contact         TEXT,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  status          TEXT DEFAULT 'active',
  "agrément"      TEXT,
  "paymentTerms"  INTEGER DEFAULT 30,
  complaints      TEXT,
  rating          NUMERIC,
  "contactName"   TEXT,
  "contactPhone"  TEXT,
  "contactEmail"  TEXT,
  "leadTime"      INTEGER,
  notes           TEXT,
  specialty       TEXT,
  note            TEXT,
  "updatedAt"     BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 6. TABLE PURCHASE_ORDERS — Bons de commande
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE "purchaseOrders" (
  id              BIGINT PRIMARY KEY,
  "supplierId"    BIGINT,
  "orderNumber"   TEXT,
  status          TEXT DEFAULT 'draft',
  date            TEXT,
  "expectedDate"  TEXT,
  "totalAmount"   NUMERIC DEFAULT 0,
  items           JSONB,
  note            TEXT,
  "createdBy"     BIGINT,
  "receivedAt"    TEXT,
  "receiveNote"   TEXT,
  "hasNonConformity" BOOLEAN DEFAULT false,
  "importedAt"    TEXT,
  "updatedAt"     BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 6.5. TABLE INVOICES — Factures fournisseurs professionnelles
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE invoices (
  id              BIGINT PRIMARY KEY,
  "invoiceNumber" TEXT,
  "supplierId"    BIGINT,
  "supplierName"  TEXT,
  date            TEXT,
  "totalAmount"   NUMERIC DEFAULT 0,
  items           JSONB,
  status          TEXT DEFAULT 'draft',
  "paymentMethod" TEXT,
  note            TEXT,
  "createdBy"     BIGINT,
  "createdAt"     BIGINT,
  "updatedAt"     BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 7. TABLE PATIENTS — Dossiers patients
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE patients (
  id          BIGINT PRIMARY KEY,
  name        TEXT,
  phone       TEXT,
  dob         TEXT,
  allergies   TEXT,
  address     TEXT,
  assurances  JSONB, -- Tableau d'assurances [{"name": "CNSS", "coverage": 80, "ref": "123"}]
  "updatedAt" BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 8. TABLE PRESCRIPTIONS — Ordonnances médicales
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE prescriptions (
  id            BIGINT PRIMARY KEY,
  "patientId"   BIGINT,
  date          TEXT,
  status        TEXT DEFAULT 'pending',
  "doctorName"  TEXT,
  items         JSONB,
  note          TEXT,
  "updatedAt"   BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 9. TABLE SALES — Ventes
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE sales (
  id                BIGINT PRIMARY KEY,
  date              TEXT,
  "patientId"       BIGINT,
  "patientName"     TEXT,
  "patientPhone"    TEXT,
  "userId"          BIGINT,
  "sellerName"      TEXT,
  total             NUMERIC DEFAULT 0,
  subtotal          NUMERIC DEFAULT 0,
  discount          NUMERIC DEFAULT 0,
  "paymentMethod"   TEXT,
  "mmPhone"         TEXT,
  status            TEXT DEFAULT 'completed',
  "prescriptionId"  BIGINT,
  "prescriptionRef" TEXT,
  "doctorName"      TEXT,
  "itemCount"       INTEGER DEFAULT 0,
  "creditDueDate"   TEXT,
  "cashReceived"    NUMERIC,
  "returnStatus"    TEXT,
  "lastReturnId"    BIGINT,
  "lastReturnDate"  TEXT,
  "insuranceDetails" JSONB, -- Détails de prise en charge multi-assurances
  "updatedAt"       BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 10. TABLE SALE_ITEMS — Détails des lignes de vente
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE "saleItems" (
  id              BIGINT PRIMARY KEY,
  "saleId"        BIGINT,
  "productId"     BIGINT,
  "productName"   TEXT,
  quantity        INTEGER DEFAULT 0,
  "unitPrice"     NUMERIC DEFAULT 0,
  "purchasePrice" NUMERIC DEFAULT 0,
  "lotId"         BIGINT,
  total           NUMERIC DEFAULT 0,
  "updatedAt"     BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 11. TABLE ALERTS — Alertes système
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE alerts (
  id            BIGINT PRIMARY KEY,
  type          TEXT,
  "productId"   BIGINT,
  "productName" TEXT,
  message       TEXT,
  status        TEXT DEFAULT 'unread',
  date          BIGINT,
  priority      TEXT DEFAULT 'medium',
  "lotId"       BIGINT,
  "updatedAt"   BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 12. TABLE RETURNS — Retours clients
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE "returns" (
  id              BIGINT PRIMARY KEY,
  "saleId"        BIGINT,
  "saleRef"       TEXT,
  "patientId"     BIGINT,
  "patientName"   TEXT,
  date            TEXT,
  reason          TEXT,
  items           JSONB,
  "refundAmount"  NUMERIC DEFAULT 0,
  "isFullReturn"  BOOLEAN DEFAULT false,
  status          TEXT DEFAULT 'approved',
  "paymentMethod" TEXT,
  "processedBy"   TEXT,
  "updatedAt"     BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 13. TABLE CASH_REGISTER — Caisse journalière & Clôtures
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE "cashRegister" (
  id                BIGINT PRIMARY KEY,
  type              TEXT, -- 'income', 'expense', 'closure'
  amount            NUMERIC DEFAULT 0,
  "paymentMethod"   TEXT,
  reason            TEXT,
  date              TEXT,
  "timestamp"       BIGINT,
  "userId"          BIGINT,
  "closedAt"        BIGINT,
  "closedBy"        TEXT,
  "openingFund"     NUMERIC DEFAULT 0,
  "expectedCash"    NUMERIC DEFAULT 0,
  "physicalCash"    NUMERIC DEFAULT 0,
  "totalSales"      NUMERIC DEFAULT 0,
  "transactionCount" BIGINT DEFAULT 0,
  "note"            TEXT,
  "updatedAt"       BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 14. TABLE AUDIT_LOG — Journal d'audit (traçabilité)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE "auditLog" (
  id          BIGINT PRIMARY KEY,
  "userId"    BIGINT,
  username    TEXT,
  action      TEXT,
  entity      TEXT,
  "entityId"  BIGINT,
  details     JSONB,
  "timestamp" BIGINT,
  ip          TEXT,
  "updatedAt" BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 15. TABLE APP_USERS — Gestion des utilisateurs
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE "app_users" (
  id          BIGINT PRIMARY KEY,
  name        TEXT,
  email       TEXT,
  username    TEXT UNIQUE,
  password    TEXT,
  role        TEXT,
  active      BOOLEAN DEFAULT true,
  "updatedAt" BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 16. TABLE SETTINGS — Paramètres clé/valeur
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  "updatedAt" BIGINT
);

-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- 18. MIGRATION — Ajout colonnes manquantes (v3.6.0)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE lots ADD COLUMN IF NOT EXISTS "destroyedQty" INTEGER DEFAULT 0;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS "destructionDate" TEXT;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS "destructionReason" TEXT;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS "destructionMethod" TEXT;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS "destructionWitnesses" TEXT;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS "destructionBy" TEXT;

ALTER TABLE alerts ADD COLUMN IF NOT EXISTS "lotId" BIGINT;

-- ═══════════════════════════════════════════════════════════════
-- 19. MIGRATION — Colonnes manquantes purchaseOrders (v4.0.1)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE "purchaseOrders" ADD COLUMN IF NOT EXISTS "orderNumber" TEXT;
ALTER TABLE "purchaseOrders" ADD COLUMN IF NOT EXISTS "expectedDate" TEXT;
ALTER TABLE "purchaseOrders" ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE "purchaseOrders" ADD COLUMN IF NOT EXISTS "createdBy" BIGINT;
ALTER TABLE "purchaseOrders" ADD COLUMN IF NOT EXISTS "receivedAt" TEXT;
ALTER TABLE "purchaseOrders" ADD COLUMN IF NOT EXISTS "receiveNote" TEXT;
ALTER TABLE "purchaseOrders" ADD COLUMN IF NOT EXISTS "hasNonConformity" BOOLEAN DEFAULT false;

-- ═══════════════════════════════════════════════════════════════
-- 20. MIGRATION — Ajout Factures & Liaisons (v4.1.0)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE lots ADD COLUMN IF NOT EXISTS "invoiceId" BIGINT;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS "invoiceRef" TEXT;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS "location" TEXT DEFAULT 'rayon';

ALTER TABLE movements ADD COLUMN IF NOT EXISTS "invoiceRef" TEXT;

-- ═══════════════════════════════════════════════════════════════
-- ✅ TERMINÉ — Toutes les tables sont prêtes. v4.0.1-stable
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- 17. SÉCURITÉ — Row Level Security (RLS Strict)
-- ═══════════════════════════════════════════════════════════════

-- RLS pour products
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_policy_select" ON "products";
CREATE POLICY "products_policy_select" ON "products" FOR SELECT USING (true);
DROP POLICY IF EXISTS "products_policy_insert" ON "products";
CREATE POLICY "products_policy_insert" ON "products" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "products_policy_update" ON "products";
CREATE POLICY "products_policy_update" ON "products" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "products_policy_delete" ON "products";
CREATE POLICY "products_policy_delete" ON "products" FOR DELETE USING (true);

-- RLS pour lots
ALTER TABLE "lots" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lots_policy_select" ON "lots";
CREATE POLICY "lots_policy_select" ON "lots" FOR SELECT USING (true);
DROP POLICY IF EXISTS "lots_policy_insert" ON "lots";
CREATE POLICY "lots_policy_insert" ON "lots" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "lots_policy_update" ON "lots";
CREATE POLICY "lots_policy_update" ON "lots" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "lots_policy_delete" ON "lots";
CREATE POLICY "lots_policy_delete" ON "lots" FOR DELETE USING (true);

-- RLS pour stock
ALTER TABLE "stock" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stock_policy_select" ON "stock";
CREATE POLICY "stock_policy_select" ON "stock" FOR SELECT USING (true);
DROP POLICY IF EXISTS "stock_policy_insert" ON "stock";
CREATE POLICY "stock_policy_insert" ON "stock" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "stock_policy_update" ON "stock";
CREATE POLICY "stock_policy_update" ON "stock" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "stock_policy_delete" ON "stock";
CREATE POLICY "stock_policy_delete" ON "stock" FOR DELETE USING (true);

-- RLS pour movements
ALTER TABLE "movements" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "movements_policy_select" ON "movements";
CREATE POLICY "movements_policy_select" ON "movements" FOR SELECT USING (true);
DROP POLICY IF EXISTS "movements_policy_insert" ON "movements";
CREATE POLICY "movements_policy_insert" ON "movements" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "movements_policy_update" ON "movements";
CREATE POLICY "movements_policy_update" ON "movements" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "movements_policy_delete" ON "movements";
CREATE POLICY "movements_policy_delete" ON "movements" FOR DELETE USING (true);

-- RLS pour suppliers
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "suppliers_policy_select" ON "suppliers";
CREATE POLICY "suppliers_policy_select" ON "suppliers" FOR SELECT USING (true);
DROP POLICY IF EXISTS "suppliers_policy_insert" ON "suppliers";
CREATE POLICY "suppliers_policy_insert" ON "suppliers" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "suppliers_policy_update" ON "suppliers";
CREATE POLICY "suppliers_policy_update" ON "suppliers" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "suppliers_policy_delete" ON "suppliers";
CREATE POLICY "suppliers_policy_delete" ON "suppliers" FOR DELETE USING (true);

-- RLS pour purchaseOrders
ALTER TABLE "purchaseOrders" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purchaseOrders_policy_select" ON "purchaseOrders";
CREATE POLICY "purchaseOrders_policy_select" ON "purchaseOrders" FOR SELECT USING (true);
DROP POLICY IF EXISTS "purchaseOrders_policy_insert" ON "purchaseOrders";
CREATE POLICY "purchaseOrders_policy_insert" ON "purchaseOrders" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "purchaseOrders_policy_update" ON "purchaseOrders";
CREATE POLICY "purchaseOrders_policy_update" ON "purchaseOrders" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "purchaseOrders_policy_delete" ON "purchaseOrders";
CREATE POLICY "purchaseOrders_policy_delete" ON "purchaseOrders" FOR DELETE USING (true);

-- RLS pour invoices
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoices_policy_select" ON "invoices";
CREATE POLICY "invoices_policy_select" ON "invoices" FOR SELECT USING (true);
DROP POLICY IF EXISTS "invoices_policy_insert" ON "invoices";
CREATE POLICY "invoices_policy_insert" ON "invoices" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "invoices_policy_update" ON "invoices";
CREATE POLICY "invoices_policy_update" ON "invoices" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "invoices_policy_delete" ON "invoices";
CREATE POLICY "invoices_policy_delete" ON "invoices" FOR DELETE USING (true);

-- RLS pour patients
ALTER TABLE "patients" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "patients_policy_select" ON "patients";
CREATE POLICY "patients_policy_select" ON "patients" FOR SELECT USING (true);
DROP POLICY IF EXISTS "patients_policy_insert" ON "patients";
CREATE POLICY "patients_policy_insert" ON "patients" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "patients_policy_update" ON "patients";
CREATE POLICY "patients_policy_update" ON "patients" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "patients_policy_delete" ON "patients";
CREATE POLICY "patients_policy_delete" ON "patients" FOR DELETE USING (true);

-- RLS pour prescriptions
ALTER TABLE "prescriptions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prescriptions_policy_select" ON "prescriptions";
CREATE POLICY "prescriptions_policy_select" ON "prescriptions" FOR SELECT USING (true);
DROP POLICY IF EXISTS "prescriptions_policy_insert" ON "prescriptions";
CREATE POLICY "prescriptions_policy_insert" ON "prescriptions" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "prescriptions_policy_update" ON "prescriptions";
CREATE POLICY "prescriptions_policy_update" ON "prescriptions" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "prescriptions_policy_delete" ON "prescriptions";
CREATE POLICY "prescriptions_policy_delete" ON "prescriptions" FOR DELETE USING (true);

-- RLS pour sales
ALTER TABLE "sales" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sales_policy_select" ON "sales";
CREATE POLICY "sales_policy_select" ON "sales" FOR SELECT USING (true);
DROP POLICY IF EXISTS "sales_policy_insert" ON "sales";
CREATE POLICY "sales_policy_insert" ON "sales" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "sales_policy_update" ON "sales";
CREATE POLICY "sales_policy_update" ON "sales" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sales_policy_delete" ON "sales";
CREATE POLICY "sales_policy_delete" ON "sales" FOR DELETE USING (true);

-- RLS pour saleItems
ALTER TABLE "saleItems" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saleItems_policy_select" ON "saleItems";
CREATE POLICY "saleItems_policy_select" ON "saleItems" FOR SELECT USING (true);
DROP POLICY IF EXISTS "saleItems_policy_insert" ON "saleItems";
CREATE POLICY "saleItems_policy_insert" ON "saleItems" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "saleItems_policy_update" ON "saleItems";
CREATE POLICY "saleItems_policy_update" ON "saleItems" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "saleItems_policy_delete" ON "saleItems";
CREATE POLICY "saleItems_policy_delete" ON "saleItems" FOR DELETE USING (true);

-- RLS pour alerts
ALTER TABLE "alerts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "alerts_policy_select" ON "alerts";
CREATE POLICY "alerts_policy_select" ON "alerts" FOR SELECT USING (true);
DROP POLICY IF EXISTS "alerts_policy_insert" ON "alerts";
CREATE POLICY "alerts_policy_insert" ON "alerts" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "alerts_policy_update" ON "alerts";
CREATE POLICY "alerts_policy_update" ON "alerts" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "alerts_policy_delete" ON "alerts";
CREATE POLICY "alerts_policy_delete" ON "alerts" FOR DELETE USING (true);

-- RLS pour returns
ALTER TABLE "returns" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "returns_policy_select" ON "returns";
CREATE POLICY "returns_policy_select" ON "returns" FOR SELECT USING (true);
DROP POLICY IF EXISTS "returns_policy_insert" ON "returns";
CREATE POLICY "returns_policy_insert" ON "returns" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "returns_policy_update" ON "returns";
CREATE POLICY "returns_policy_update" ON "returns" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "returns_policy_delete" ON "returns";
CREATE POLICY "returns_policy_delete" ON "returns" FOR DELETE USING (true);

-- RLS pour cashRegister
ALTER TABLE "cashRegister" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cashRegister_policy_select" ON "cashRegister";
CREATE POLICY "cashRegister_policy_select" ON "cashRegister" FOR SELECT USING (true);
DROP POLICY IF EXISTS "cashRegister_policy_insert" ON "cashRegister";
CREATE POLICY "cashRegister_policy_insert" ON "cashRegister" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "cashRegister_policy_update" ON "cashRegister";
CREATE POLICY "cashRegister_policy_update" ON "cashRegister" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "cashRegister_policy_delete" ON "cashRegister";
CREATE POLICY "cashRegister_policy_delete" ON "cashRegister" FOR DELETE USING (true);

-- RLS pour auditLog
ALTER TABLE "auditLog" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auditLog_policy_select" ON "auditLog";
CREATE POLICY "auditLog_policy_select" ON "auditLog" FOR SELECT USING (true);
DROP POLICY IF EXISTS "auditLog_policy_insert" ON "auditLog";
CREATE POLICY "auditLog_policy_insert" ON "auditLog" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "auditLog_policy_update" ON "auditLog";
CREATE POLICY "auditLog_policy_update" ON "auditLog" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auditLog_policy_delete" ON "auditLog";
CREATE POLICY "auditLog_policy_delete" ON "auditLog" FOR DELETE USING (true);

-- RLS pour app_users
ALTER TABLE "app_users" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_users_policy_select" ON "app_users";
CREATE POLICY "app_users_policy_select" ON "app_users" FOR SELECT USING (true);
DROP POLICY IF EXISTS "app_users_policy_insert" ON "app_users";
CREATE POLICY "app_users_policy_insert" ON "app_users" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "app_users_policy_update" ON "app_users";
CREATE POLICY "app_users_policy_update" ON "app_users" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "app_users_policy_delete" ON "app_users";
CREATE POLICY "app_users_policy_delete" ON "app_users" FOR DELETE USING (true);

-- RLS pour settings
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_policy_select" ON "settings";
CREATE POLICY "settings_policy_select" ON "settings" FOR SELECT USING (true);
DROP POLICY IF EXISTS "settings_policy_insert" ON "settings";
CREATE POLICY "settings_policy_insert" ON "settings" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "settings_policy_update" ON "settings";
CREATE POLICY "settings_policy_update" ON "settings" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "settings_policy_delete" ON "settings";
CREATE POLICY "settings_policy_delete" ON "settings" FOR DELETE USING (true);

ALTER TABLE "purchaseOrders" ADD COLUMN IF NOT EXISTS "createdBy" BIGINT;
ALTER TABLE "purchaseOrders" ADD COLUMN IF NOT EXISTS "receivedAt" TEXT;
ALTER TABLE "purchaseOrders" ADD COLUMN IF NOT EXISTS "receiveNote" TEXT;
ALTER TABLE "purchaseOrders" ADD COLUMN IF NOT EXISTS "hasNonConformity" BOOLEAN DEFAULT false;

-- ═══════════════════════════════════════════════════════════════
-- ✅ TERMINÉ — Toutes les tables sont prêtes. v4.0.1-stable
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- 17. SÉCURITÉ — Row Level Security (RLS Strict)
-- ═══════════════════════════════════════════════════════════════

-- RLS pour products
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_policy_select" ON "products";
CREATE POLICY "products_policy_select" ON "products" FOR SELECT USING (true);
DROP POLICY IF EXISTS "products_policy_insert" ON "products";
CREATE POLICY "products_policy_insert" ON "products" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "products_policy_update" ON "products";
CREATE POLICY "products_policy_update" ON "products" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "products_policy_delete" ON "products";
CREATE POLICY "products_policy_delete" ON "products" FOR DELETE USING (true);

-- RLS pour lots
ALTER TABLE "lots" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lots_policy_select" ON "lots";
CREATE POLICY "lots_policy_select" ON "lots" FOR SELECT USING (true);
DROP POLICY IF EXISTS "lots_policy_insert" ON "lots";
CREATE POLICY "lots_policy_insert" ON "lots" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "lots_policy_update" ON "lots";
CREATE POLICY "lots_policy_update" ON "lots" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "lots_policy_delete" ON "lots";
CREATE POLICY "lots_policy_delete" ON "lots" FOR DELETE USING (true);

-- RLS pour stock
ALTER TABLE "stock" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stock_policy_select" ON "stock";
CREATE POLICY "stock_policy_select" ON "stock" FOR SELECT USING (true);
DROP POLICY IF EXISTS "stock_policy_insert" ON "stock";
CREATE POLICY "stock_policy_insert" ON "stock" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "stock_policy_update" ON "stock";
CREATE POLICY "stock_policy_update" ON "stock" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "stock_policy_delete" ON "stock";
CREATE POLICY "stock_policy_delete" ON "stock" FOR DELETE USING (true);

-- RLS pour movements
ALTER TABLE "movements" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "movements_policy_select" ON "movements";
CREATE POLICY "movements_policy_select" ON "movements" FOR SELECT USING (true);
DROP POLICY IF EXISTS "movements_policy_insert" ON "movements";
CREATE POLICY "movements_policy_insert" ON "movements" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "movements_policy_update" ON "movements";
CREATE POLICY "movements_policy_update" ON "movements" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "movements_policy_delete" ON "movements";
CREATE POLICY "movements_policy_delete" ON "movements" FOR DELETE USING (true);

-- RLS pour suppliers
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "suppliers_policy_select" ON "suppliers";
CREATE POLICY "suppliers_policy_select" ON "suppliers" FOR SELECT USING (true);
DROP POLICY IF EXISTS "suppliers_policy_insert" ON "suppliers";
CREATE POLICY "suppliers_policy_insert" ON "suppliers" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "suppliers_policy_update" ON "suppliers";
CREATE POLICY "suppliers_policy_update" ON "suppliers" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "suppliers_policy_delete" ON "suppliers";
CREATE POLICY "suppliers_policy_delete" ON "suppliers" FOR DELETE USING (true);

-- RLS pour purchaseOrders
ALTER TABLE "purchaseOrders" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purchaseOrders_policy_select" ON "purchaseOrders";
CREATE POLICY "purchaseOrders_policy_select" ON "purchaseOrders" FOR SELECT USING (true);
DROP POLICY IF EXISTS "purchaseOrders_policy_insert" ON "purchaseOrders";
CREATE POLICY "purchaseOrders_policy_insert" ON "purchaseOrders" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "purchaseOrders_policy_update" ON "purchaseOrders";
CREATE POLICY "purchaseOrders_policy_update" ON "purchaseOrders" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "purchaseOrders_policy_delete" ON "purchaseOrders";
CREATE POLICY "purchaseOrders_policy_delete" ON "purchaseOrders" FOR DELETE USING (true);

-- RLS pour invoices
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoices_policy_select" ON "invoices";
CREATE POLICY "invoices_policy_select" ON "invoices" FOR SELECT USING (true);
DROP POLICY IF EXISTS "invoices_policy_insert" ON "invoices";
CREATE POLICY "invoices_policy_insert" ON "invoices" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "invoices_policy_update" ON "invoices";
CREATE POLICY "invoices_policy_update" ON "invoices" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "invoices_policy_delete" ON "invoices";
CREATE POLICY "invoices_policy_delete" ON "invoices" FOR DELETE USING (true);

-- RLS pour patients
ALTER TABLE "patients" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "patients_policy_select" ON "patients";
CREATE POLICY "patients_policy_select" ON "patients" FOR SELECT USING (true);
DROP POLICY IF EXISTS "patients_policy_insert" ON "patients";
CREATE POLICY "patients_policy_insert" ON "patients" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "patients_policy_update" ON "patients";
CREATE POLICY "patients_policy_update" ON "patients" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "patients_policy_delete" ON "patients";
CREATE POLICY "patients_policy_delete" ON "patients" FOR DELETE USING (true);

-- RLS pour prescriptions
ALTER TABLE "prescriptions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prescriptions_policy_select" ON "prescriptions";
CREATE POLICY "prescriptions_policy_select" ON "prescriptions" FOR SELECT USING (true);
DROP POLICY IF EXISTS "prescriptions_policy_insert" ON "prescriptions";
CREATE POLICY "prescriptions_policy_insert" ON "prescriptions" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "prescriptions_policy_update" ON "prescriptions";
CREATE POLICY "prescriptions_policy_update" ON "prescriptions" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "prescriptions_policy_delete" ON "prescriptions";
CREATE POLICY "prescriptions_policy_delete" ON "prescriptions" FOR DELETE USING (true);

-- RLS pour sales
ALTER TABLE "sales" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sales_policy_select" ON "sales";
CREATE POLICY "sales_policy_select" ON "sales" FOR SELECT USING (true);
DROP POLICY IF EXISTS "sales_policy_insert" ON "sales";
CREATE POLICY "sales_policy_insert" ON "sales" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "sales_policy_update" ON "sales";
CREATE POLICY "sales_policy_update" ON "sales" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sales_policy_delete" ON "sales";
CREATE POLICY "sales_policy_delete" ON "sales" FOR DELETE USING (true);

-- RLS pour saleItems
ALTER TABLE "saleItems" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saleItems_policy_select" ON "saleItems";
CREATE POLICY "saleItems_policy_select" ON "saleItems" FOR SELECT USING (true);
DROP POLICY IF EXISTS "saleItems_policy_insert" ON "saleItems";
CREATE POLICY "saleItems_policy_insert" ON "saleItems" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "saleItems_policy_update" ON "saleItems";
CREATE POLICY "saleItems_policy_update" ON "saleItems" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "saleItems_policy_delete" ON "saleItems";
CREATE POLICY "saleItems_policy_delete" ON "saleItems" FOR DELETE USING (true);

-- RLS pour alerts
ALTER TABLE "alerts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "alerts_policy_select" ON "alerts";
CREATE POLICY "alerts_policy_select" ON "alerts" FOR SELECT USING (true);
DROP POLICY IF EXISTS "alerts_policy_insert" ON "alerts";
CREATE POLICY "alerts_policy_insert" ON "alerts" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "alerts_policy_update" ON "alerts";
CREATE POLICY "alerts_policy_update" ON "alerts" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "alerts_policy_delete" ON "alerts";
CREATE POLICY "alerts_policy_delete" ON "alerts" FOR DELETE USING (true);

-- RLS pour returns
ALTER TABLE "returns" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "returns_policy_select" ON "returns";
CREATE POLICY "returns_policy_select" ON "returns" FOR SELECT USING (true);
DROP POLICY IF EXISTS "returns_policy_insert" ON "returns";
CREATE POLICY "returns_policy_insert" ON "returns" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "returns_policy_update" ON "returns";
CREATE POLICY "returns_policy_update" ON "returns" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "returns_policy_delete" ON "returns";
CREATE POLICY "returns_policy_delete" ON "returns" FOR DELETE USING (true);

-- RLS pour cashRegister
ALTER TABLE "cashRegister" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cashRegister_policy_select" ON "cashRegister";
CREATE POLICY "cashRegister_policy_select" ON "cashRegister" FOR SELECT USING (true);
DROP POLICY IF EXISTS "cashRegister_policy_insert" ON "cashRegister";
CREATE POLICY "cashRegister_policy_insert" ON "cashRegister" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "cashRegister_policy_update" ON "cashRegister";
CREATE POLICY "cashRegister_policy_update" ON "cashRegister" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "cashRegister_policy_delete" ON "cashRegister";
CREATE POLICY "cashRegister_policy_delete" ON "cashRegister" FOR DELETE USING (true);

-- RLS pour auditLog
ALTER TABLE "auditLog" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auditLog_policy_select" ON "auditLog";
CREATE POLICY "auditLog_policy_select" ON "auditLog" FOR SELECT USING (true);
DROP POLICY IF EXISTS "auditLog_policy_insert" ON "auditLog";
CREATE POLICY "auditLog_policy_insert" ON "auditLog" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "auditLog_policy_update" ON "auditLog";
CREATE POLICY "auditLog_policy_update" ON "auditLog" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auditLog_policy_delete" ON "auditLog";
CREATE POLICY "auditLog_policy_delete" ON "auditLog" FOR DELETE USING (true);

-- RLS pour app_users
ALTER TABLE "app_users" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_users_policy_select" ON "app_users";
CREATE POLICY "app_users_policy_select" ON "app_users" FOR SELECT USING (true);
DROP POLICY IF EXISTS "app_users_policy_insert" ON "app_users";
CREATE POLICY "app_users_policy_insert" ON "app_users" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "app_users_policy_update" ON "app_users";
CREATE POLICY "app_users_policy_update" ON "app_users" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "app_users_policy_delete" ON "app_users";
CREATE POLICY "app_users_policy_delete" ON "app_users" FOR DELETE USING (true);

-- RLS pour settings
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_policy_select" ON "settings";
CREATE POLICY "settings_policy_select" ON "settings" FOR SELECT USING (true);
DROP POLICY IF EXISTS "settings_policy_insert" ON "settings";
CREATE POLICY "settings_policy_insert" ON "settings" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "settings_policy_update" ON "settings";
CREATE POLICY "settings_policy_update" ON "settings" FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "settings_policy_delete" ON "settings";
CREATE POLICY "settings_policy_delete" ON "settings" FOR DELETE USING (true);

CREATE TABLE IF NOT EXISTS pull_tracking (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT NOT NULL,
  device_name TEXT,
  pharmacy_name TEXT,
  user_name TEXT,
  pulled_at TIMESTAMPTZ DEFAULT NOW(),
  items_pulled INTEGER DEFAULT 0,
  ip_address TEXT
);

ALTER TABLE pull_tracking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_insert" ON pull_tracking;
CREATE POLICY "allow_insert" ON pull_tracking FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "allow_select_admin" ON pull_tracking;
CREATE POLICY "allow_select_admin" ON pull_tracking FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS push_tracking (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT NOT NULL,
  device_name TEXT,
  pharmacy_name TEXT,
  user_name TEXT,
  pushed_at TIMESTAMPTZ DEFAULT NOW(),
  items_pushed INTEGER DEFAULT 0,
  ip_address TEXT
);

ALTER TABLE push_tracking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_insert_push" ON push_tracking;
CREATE POLICY "allow_insert_push" ON push_tracking FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "allow_select_admin_push" ON push_tracking;
CREATE POLICY "allow_select_admin_push" ON push_tracking FOR SELECT USING (true);
-- Sans cette colonne, impossible de savoir si "quantité: 2" signifie 2 boîtes ou 2 comprimés 
ALTER TABLE "saleItems" ADD COLUMN IF NOT EXISTS "saleMode" TEXT DEFAULT 'box';

-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION v9.3.3 — Alignement complet schéma local ↔ Supabase
-- Exécuter ces ALTER TABLE dans le SQL Editor de Supabase
-- Toutes les commandes sont idempotentes (IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── PRODUCTS : Déconditionnement + Contrôle + Fabricant ──
ALTER TABLE products ADD COLUMN IF NOT EXISTS "subUnitsPerBox" INTEGER DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "pricePerSubUnit" NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "isControlled" BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "controlledClass" TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS manufacturer TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "noticePdfUrl" TEXT;

-- ── SALES : Assurance + Patient + Remise + Retours ──
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "assuranceName" TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "assuranceRef" TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "assuranceAmount" NUMERIC DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "paymentDetails" JSONB;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "paidAt" TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "paidDate" TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "paidMethod" TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "returnStatus" TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "lastReturnId" BIGINT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "lastReturnDate" TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "patientName" TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "patientPhone" TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "patientId" BIGINT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "discountType" TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "prescriptionId" BIGINT;

-- ── SALE_ITEMS : Détails produit embarqués ──
ALTER TABLE "saleItems" ADD COLUMN IF NOT EXISTS "lotNumber" TEXT;
ALTER TABLE "saleItems" ADD COLUMN IF NOT EXISTS "productName" TEXT;
ALTER TABLE "saleItems" ADD COLUMN IF NOT EXISTS dci TEXT;
ALTER TABLE "saleItems" ADD COLUMN IF NOT EXISTS dosage TEXT;
ALTER TABLE "saleItems" ADD COLUMN IF NOT EXISTS "purchasePrice" NUMERIC DEFAULT 0;
ALTER TABLE "saleItems" ADD COLUMN IF NOT EXISTS "requiresPrescription" BOOLEAN DEFAULT false;

-- ── RETURNS : Infos patient + traitement ──
ALTER TABLE returns ADD COLUMN IF NOT EXISTS "patientName" TEXT;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS "processedBy" TEXT;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS "isFullReturn" BOOLEAN DEFAULT false;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS "saleRef" TEXT;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS "patientId" BIGINT;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;

-- ── MOVEMENTS : Sous-type + références ──
ALTER TABLE movements ADD COLUMN IF NOT EXISTS "subType" TEXT;
ALTER TABLE movements ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE movements ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE movements ADD COLUMN IF NOT EXISTS "lotNumber" TEXT;

-- ── CASH_REGISTER : Références croisées ──
ALTER TABLE "cashRegister" ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE "cashRegister" ADD COLUMN IF NOT EXISTS "saleId" BIGINT;
ALTER TABLE "cashRegister" ADD COLUMN IF NOT EXISTS "returnId" BIGINT;
ALTER TABLE "cashRegister" ADD COLUMN IF NOT EXISTS "timestamp" BIGINT;
ALTER TABLE "cashRegister" ADD COLUMN IF NOT EXISTS "sessionId" TEXT;

-- ── AUDIT_LOG : Détails de traçabilité ──
ALTER TABLE "auditLog" ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE "auditLog" ADD COLUMN IF NOT EXISTS entity TEXT;
ALTER TABLE "auditLog" ADD COLUMN IF NOT EXISTS "entityId" BIGINT;
ALTER TABLE "auditLog" ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE "auditLog" ADD COLUMN IF NOT EXISTS "userName" TEXT;

-- ── PURCHASE_ORDERS : Dates de suivi ──
ALTER TABLE "purchaseOrders" ADD COLUMN IF NOT EXISTS "sentAt" TEXT;
ALTER TABLE "purchaseOrders" ADD COLUMN IF NOT EXISTS "cancelledAt" TEXT;
ALTER TABLE "purchaseOrders" ADD COLUMN IF NOT EXISTS "receivedBy" TEXT;
ALTER TABLE "purchaseOrders" ADD COLUMN IF NOT EXISTS notes TEXT;

-- ── SUPPLIERS : Évaluation + contact détaillé ──
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS rating NUMERIC DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "contactName" TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "leadTime" INTEGER DEFAULT 7;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS notes TEXT;

-- ── PATIENTS : Infos médicales complètes ──
ALTER TABLE patients ADD COLUMN IF NOT EXISTS "createdAt" BIGINT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS "creditLimit" NUMERIC DEFAULT 0;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurance TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS "insuranceNumber" TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS "bloodType" TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS "emergencyContact" TEXT;

-- ── PRESCRIPTIONS : Détails complets ──
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS "patientName" TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS "dispensedAt" TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS "dispensedBy" TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS "saleId" BIGINT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS "archiveDate" TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS "doctorEstablishment" TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS "doctorOrderNumber" TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS "doctorSpecialty" TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS "photoData" TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS "renewCount" INTEGER DEFAULT 0;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS "renewUsed" INTEGER DEFAULT 0;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS renewable BOOLEAN DEFAULT false;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS "validatedAt" TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS "validatedBy" TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS "validityDate" TEXT;

ALTER PUBLICATION supabase_realtime ADD TABLE products, stock, sales, "saleItems", settings, app_users, patients, returns, "cashRegister", movements, lots, suppliers, "purchaseOrders", prescriptions, "auditLog", alerts;

-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION v9.3.5 — Audit complet : TOUTES les colonnes locales → Supabase
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── PATIENTS : colonnes manquantes ──
ALTER TABLE patients ADD COLUMN IF NOT EXISTS "createdAt" TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS "creditLimit" NUMERIC DEFAULT 0;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurance TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS "insuranceNumber" TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS "bloodType" TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS "emergencyContact" TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS "medicalHistory" JSONB;

-- ── PATIENTS : correction type updatedAt (BIGINT → TEXT pour accepter ISO dates) ──
ALTER TABLE patients ALTER COLUMN "updatedAt" TYPE TEXT USING "updatedAt"::TEXT;

-- ── CASHREGISTER : colonnes manquantes ──
ALTER TABLE "cashRegister" ADD COLUMN IF NOT EXISTS "closedByRole" TEXT;
ALTER TABLE "cashRegister" ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE "cashRegister" ADD COLUMN IF NOT EXISTS "saleId" BIGINT;
ALTER TABLE "cashRegister" ADD COLUMN IF NOT EXISTS "returnId" BIGINT;
ALTER TABLE "cashRegister" ADD COLUMN IF NOT EXISTS "refundAmount" NUMERIC DEFAULT 0;

-- ── SALES : colonnes manquantes ──
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "paymentDetails" JSONB;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "assuranceName" TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "assuranceRef" TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "assuranceAmount" NUMERIC DEFAULT 0;

-- ── SALEITEMS : colonnes manquantes ──
ALTER TABLE "saleItems" ADD COLUMN IF NOT EXISTS "lotNumber" TEXT;
ALTER TABLE "saleItems" ADD COLUMN IF NOT EXISTS "saleMode" TEXT DEFAULT 'box';

-- ── MOVEMENTS : colonnes manquantes ──
ALTER TABLE movements ADD COLUMN IF NOT EXISTS "subType" TEXT;
ALTER TABLE movements ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE movements ADD COLUMN IF NOT EXISTS "lotNumber" TEXT;

-- ── RETURNS : correction type updatedAt ──
ALTER TABLE returns ALTER COLUMN "updatedAt" TYPE TEXT USING "updatedAt"::TEXT;

-- ── CASHREGISTER : correction type updatedAt ──
ALTER TABLE "cashRegister" ALTER COLUMN "updatedAt" TYPE TEXT USING "updatedAt"::TEXT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- FIN MIGRATION v9.3.5
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- GRANTS EXPLICITES — Requis par Supabase à partir du 30 octobre 2026
-- Sans ces GRANT, l'API REST (supabase-js) ne pourra plus accéder aux tables.
-- ═══════════════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE, DELETE ON products TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON lots TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON stock TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON movements TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON suppliers TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON "purchaseOrders" TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON sales TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON "saleItems" TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON patients TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON prescriptions TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON alerts TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON "cashRegister" TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON "auditLog" TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON settings TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON app_users TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON returns TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON push_tracking TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON pull_tracking TO anon, authenticated, service_role;

-- Séquences (auto-increment)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER TABLE patients ALTER COLUMN "createdAt" TYPE TEXT USING "createdAt"::TEXT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- FIN — Après exécution, vider le cache : localStorage.removeItem('pharma_bad_columns');
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION v9.4.0 — Double traçabilité Vendeur/Préparateur + colonnes manquantes
-- Exécuter dans le SQL Editor de Supabase
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── SALES : Double traçabilité vendeur/préparateur ──
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "preparerId" BIGINT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "preparerName" TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "sellerName" TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "prescriptionRef" TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "doctorName" TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "mmPhone" TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "creditDueDate" TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "cashReceived" NUMERIC;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "itemCount" INTEGER DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "insuranceDetails" JSONB;

-- ── SALEITEMS : colonnes produit embarquées ──
ALTER TABLE "saleItems" ADD COLUMN IF NOT EXISTS dci TEXT;
ALTER TABLE "saleItems" ADD COLUMN IF NOT EXISTS dosage TEXT;
ALTER TABLE "saleItems" ADD COLUMN IF NOT EXISTS "requiresPrescription" BOOLEAN DEFAULT false;

-- 1. Ajouter la colonne 'shift' à la table des utilisateurs
ALTER TABLE app_users 
ADD COLUMN IF NOT EXISTS shift TEXT DEFAULT NULL;

-- 2. Ajouter la colonne 'data' à la table des paramètres
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS data JSONB DEFAULT NULL;

-- 3. Corriger le type de entityId dans auditLog (bigint → text)
ALTER TABLE "auditLog" 
ALTER COLUMN "entityId" TYPE TEXT USING "entityId"::TEXT;

-- ═══════════════════════════════════════════════
-- TABLE : shifts — Gestion des équipes OrdiveX
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.shifts (
  id          TEXT PRIMARY KEY,
  type        TEXT,                    -- 'matin', 'soir', 'nuit'
  "managerName" TEXT,
  "managerId"   TEXT,
  members     JSONB DEFAULT '[]',     -- tableau d'IDs utilisateurs
  note        TEXT DEFAULT '',
  status      TEXT DEFAULT 'open',    -- 'open' ou 'closed'
  "openedAt"  BIGINT,                 -- timestamp ms
  "closedAt"  BIGINT,                 -- timestamp ms (null si ouvert)
  date        TEXT,                   -- ISO date string
  "updatedAt" BIGINT DEFAULT 0       -- requis pour la sync delta OrdiveX
);

-- Index pour les requêtes de sync delta (performance)
CREATE INDEX IF NOT EXISTS idx_shifts_updated ON public.shifts ("updatedAt");
CREATE INDEX IF NOT EXISTS idx_shifts_status ON public.shifts (status);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON public.shifts (date);

-- Politique RLS : accès total pour les clés anon/service (comme les autres tables OrdiveX)
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shifts_full_access" ON public.shifts;
CREATE POLICY "shifts_full_access" ON public.shifts
  FOR ALL
  USING (true)
  WITH CHECK (true);
-- ═══════════════════════════════════════════════════════════════════════════════
-- IMPORTANT : Après exécution de cette migration, VIDER le cache navigateur :
-- Dans la console du navigateur : localStorage.removeItem('pharma_bad_columns');
-- Puis recharger la page (Ctrl+Shift+R)
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE products ADD COLUMN IF NOT EXISTS "productType" TEXT DEFAULT 'generic';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "assuranceName" TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "assuranceRef" TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "assuranceAmount" NUMERIC DEFAULT 0;


-- ============================================================
-- OrdiveX v9.7.84 — Nouveau module Assurances & Tiers Payant
-- Exécuter dans : Supabase → SQL Editor → New Query
-- ✅ CREATE TABLE IF NOT EXISTS = aucune perte de données
-- ✅ RLS activé selon le pattern des autres tables
-- ============================================================
-- ──────────────────────────────────────────────────────────
-- TABLE 1 : insurances
-- Entité assurance (organisme, conditions, couverture %)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.insurances (
  id                BIGINT PRIMARY KEY,
  name              TEXT NOT NULL,           -- Nom de l'assurance / organisme
  code              TEXT,                    -- Code interne
  contact           TEXT,                    -- Nom du contact
  phone             TEXT,                    -- Téléphone
  email             TEXT,                    -- Email
  address           TEXT,                    -- Adresse postale
  referent          TEXT,                    -- Personne de référence
  conditions        TEXT,                    -- Conditions de prise en charge
  coveragePercent   NUMERIC(5,2) DEFAULT 0,  -- % de couverture (0-100)
  paymentMode       TEXT DEFAULT 'invoice',  -- 'invoice' | 'direct'
  status            TEXT DEFAULT 'active',   -- 'active' | 'inactive'
  observations      TEXT,
  createdAt         BIGINT,
  updatedAt         BIGINT,
  _synced           BOOLEAN DEFAULT TRUE
);
-- Index pour accélérer les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_insurances_status    ON public.insurances (status);
CREATE INDEX IF NOT EXISTS idx_insurances_name      ON public.insurances (name);
CREATE INDEX IF NOT EXISTS idx_insurances_updatedat ON public.insurances (updatedAt);
-- Row Level Security
ALTER TABLE public.insurances ENABLE ROW LEVEL SECURITY;
-- Politique : accès complet aux utilisateurs authentifiés
DROP POLICY IF EXISTS "insurances_all" ON public.insurances;
CREATE POLICY "insurances_all" ON public.insurances
  FOR ALL USING (auth.role() = 'authenticated');
-- ──────────────────────────────────────────────────────────
-- TABLE 2 : insurancePayments
-- Règlements reçus d'une assurance (paiements tiers payant)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."insurancePayments" (
  id              BIGINT PRIMARY KEY,
  insuranceId     BIGINT REFERENCES public.insurances(id) ON DELETE SET NULL,
  amount          NUMERIC(15,2) DEFAULT 0,  -- Montant du règlement
  paymentMethod   TEXT DEFAULT 'transfer',  -- 'cash' | 'transfer' | 'orange_money' | 'mtn_momo'
  reference       TEXT,                     -- Référence virement / chèque
  observations    TEXT,
  userId          BIGINT,                   -- Utilisateur ayant enregistré le règlement
  date            TEXT,                     -- Date au format YYYY-MM-DD
  timestamp       BIGINT,                   -- Timestamp précis (ms)
  createdAt       BIGINT,
  updatedAt       BIGINT,
  _synced         BOOLEAN DEFAULT TRUE
);
-- Index
CREATE INDEX IF NOT EXISTS idx_inspaym_insuranceid  ON public."insurancePayments" (insuranceId);
CREATE INDEX IF NOT EXISTS idx_inspaym_date         ON public."insurancePayments" (date);
CREATE INDEX IF NOT EXISTS idx_inspaym_updatedat    ON public."insurancePayments" (updatedAt);
-- Row Level Security
ALTER TABLE public."insurancePayments" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "insurancePayments_all" ON public."insurancePayments";
CREATE POLICY "insurancePayments_all" ON public."insurancePayments"
  FOR ALL USING (auth.role() = 'authenticated');
-- ──────────────────────────────────────────────────────────
-- Colonnes insuranceId dans les tables existantes
-- (pour les ventes en tiers payant)
-- ──────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.sales
  ADD COLUMN IF NOT EXISTS insuranceId          BIGINT,
  ADD COLUMN IF NOT EXISTS insurancePaidAmount  NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assuranceAmount      NUMERIC(15,2) DEFAULT 0;
ALTER TABLE IF EXISTS public.patients
  ADD COLUMN IF NOT EXISTS assurances JSONB;   -- tableau des assurances liées
-- ──────────────────────────────────────────────────────────
-- Vérification : lister les nouvelles tables
-- ──────────────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('insurances', 'insurancePayments')
ORDER BY table_name;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTIE 2/2 — supabase_nouvelle_pharmacie_complements.sql (contenu intégral, inchangé)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- OrdiveX — Compléments schéma pour une NOUVELLE pharmacie
--
-- À exécuter UNE SEULE FOIS, JUSTE APRÈS supabase_schema.sql (dans cet ordre),
-- sur un projet Supabase tout neuf. Idempotent (IF NOT EXISTS partout) : sûr
-- à ré-exécuter sans danger si besoin.
--
-- Contexte : supabase_schema.sql couvre déjà la quasi-totalité des tables que
-- l'app synchronise (voir js/db.js, storesToSync/storesToPull), SAUF les
-- écarts identifiés en comparant précisément son contenu au code applicatif
-- actuel :
--   1. La table "prep_transfers" (file de préparation → caisse) n'existe pas
--      du tout dans supabase_schema.sql.
--   2. "invoices" dans supabase_schema.sql n'a pas les colonnes subtotal et
--      tvaAmount, que js/pages/invoices.js écrit pourtant à chaque facture.
--   3. "saleItems" dans supabase_schema.sql n'a pas la colonne lotNumber, dont
--      annulerVente() et le traitement des retours ont besoin pour recréditer
--      le BON lot en stock (pas juste le total global).
--   4. "invoices" n'a pas les colonnes paid/paidDate (statut de paiement
--      fournisseur) et "cashRegister" n'a pas la colonne category
--      (catégorisation des mouvements de caisse manuels) — ajoutées en
--      octobre 2026. Sans elles, ces deux fonctionnalités marchent sur un
--      seul appareil mais ne se synchronisent jamais entre postes ni vers le
--      cloud (le champ est silencieusement ignoré par la synchro).
--   5. "app_users" n'a pas les colonnes termsAccepted/termsAcceptedAt
--      (acceptation des Conditions d'Utilisation, posée automatiquement à
--      la création de tout compte depuis octobre 2026) — même conséquence
--      sans elles : jamais synchronisé entre postes ni vers le cloud.
--   6. "sales" n'a JAMAIS eu creditStatus, paidAt, paidDate, paidMethod,
--      preparerId, preparerName, insuranceId, assuranceName, assuranceRef,
--      assuranceAmount, insurancePaidAmount, paymentDetails — pourtant
--      écrites à chaque vente et à chaque règlement de dette (POS,
--      Historique Ventes, Dossier Patient, Assurances & Tiers Payant).
--      CONSÉQUENCE GRAVE sans elles : un règlement de dette se fait
--      normalement sur le moment, mais réapparaît comme "en cours" après
--      fermeture/réouverture de l'app ou sur un autre appareil (le champ
--      ne quitte jamais l'appareil d'origine, un pull ultérieur re-télécharge
--      la version toujours non-réglée restée sur Supabase et écrase la
--      version locale correctement réglée). Voir aussi le script dédié
--      ajout_colonnes_sales_dettes_assurance.sql (pharmacies déjà en place),
--      qui explique l'étape "Réparer l'envoi Cloud" obligatoire en plus de
--      ce script SQL.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. TABLE : prep_transfers — File de préparation → Caisse
-- ───────────────────────────────────────────────────────────────
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

GRANT SELECT, INSERT, UPDATE, DELETE ON "prep_transfers" TO anon, authenticated, service_role;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "prep_transfers";
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ───────────────────────────────────────────────────────────────
-- 2. TABLE : invoices — colonnes manquantes dans supabase_schema.sql
-- ───────────────────────────────────────────────────────────────
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal NUMERIC(15,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "tvaAmount" NUMERIC(15,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS _synced BOOLEAN DEFAULT TRUE;

-- ───────────────────────────────────────────────────────────────
-- 3. TABLE : saleItems — colonne manquante dans supabase_schema.sql
-- ───────────────────────────────────────────────────────────────
ALTER TABLE "saleItems" ADD COLUMN IF NOT EXISTS "lotNumber" TEXT;

-- ───────────────────────────────────────────────────────────────
-- 4. TABLE : invoices (statut de paiement) + cashRegister (catégorie)
-- ───────────────────────────────────────────────────────────────
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT FALSE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "paidDate" TEXT;
ALTER TABLE "cashRegister" ADD COLUMN IF NOT EXISTS category TEXT;

-- ───────────────────────────────────────────────────────────────
-- 5. TABLE : app_users — acceptation des Conditions d'Utilisation
-- ───────────────────────────────────────────────────────────────
ALTER TABLE "app_users" ADD COLUMN IF NOT EXISTS "termsAccepted" BOOLEAN DEFAULT FALSE;
ALTER TABLE "app_users" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" BIGINT;

-- ───────────────────────────────────────────────────────────────
-- 6. TABLE : sales — colonnes de reglement de dette + assurance (CRITIQUE)
-- ───────────────────────────────────────────────────────────────
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "creditStatus" TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "paidAt" BIGINT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "paidDate" TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "paidMethod" TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "preparerId" BIGINT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "preparerName" TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "insuranceId" BIGINT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "assuranceName" TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "assuranceRef" TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "assuranceAmount" NUMERIC;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "insurancePaidAmount" NUMERIC;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "paymentDetails" JSONB;

-- ───────────────────────────────────────────────────────────────
-- Vérification finale
-- ───────────────────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'prep_transfers';

SELECT table_name, column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'invoices' AND column_name IN ('subtotal', 'tvaAmount', '_synced', 'paid', 'paidDate'))
    OR (table_name = 'saleItems' AND column_name = 'lotNumber')
    OR (table_name = 'cashRegister' AND column_name = 'category')
    OR (table_name = 'app_users' AND column_name IN ('termsAccepted', 'termsAcceptedAt'))
    OR (table_name = 'sales' AND column_name IN ('creditStatus', 'paidAt', 'paidDate', 'paidMethod',
        'preparerId', 'preparerName', 'insuranceId', 'assuranceName', 'assuranceRef',
        'assuranceAmount', 'insurancePaidAmount', 'paymentDetails')))
ORDER BY table_name, column_name;
