-- ============================================================
-- OrdiveX v9 — Script SQL Supabase COMPLET (CamelCase Safe)
-- Exécuter dans : Supabase → SQL Editor → New Query
-- ✅ CREATE TABLE IF NOT EXISTS = aucune perte de données
-- ✅ ADD COLUMN IF NOT EXISTS  = sécurisé si colonne existe
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. EXTENSION UUID (si pas encore activée)
-- ──────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ──────────────────────────────────────────────────────────
-- 2. TABLE app_users (déjà existante — ajout des colonnes manquantes)
-- ──────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS id         BIGINT;
ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS username   TEXT;
ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS password   TEXT;
ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS name       TEXT;
ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS role       TEXT DEFAULT 'caissier';
ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS active     BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS "updatedAt"  BIGINT;
ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS "createdAt"  BIGINT;

-- Colonnes RH (causaient les 400 Bad Request)
ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS nom              TEXT;
ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS poste            TEXT;
ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS department       TEXT;
ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS "dateEmbauche"     TEXT;
ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS "dateNaissance"    TEXT;
ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS salaire          NUMERIC(15,2) DEFAULT 0;
ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS "typeContrat"      TEXT;
ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS "dateFinContrat"   TEXT;
ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS telephone        TEXT;
ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS cni              TEXT;
ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS adresse          TEXT;
ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS "contactUrgence"   TEXT;
ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS status           TEXT DEFAULT 'actif';
ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS notes            TEXT;

-- ──────────────────────────────────────────────────────────
-- 3. TABLE settings
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  "updatedAt"  BIGINT
);

-- ──────────────────────────────────────────────────────────
-- 4. TABLE products (catalogue médicaments)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  id                    BIGINT PRIMARY KEY,
  code                  TEXT UNIQUE,
  name                  TEXT NOT NULL,
  dci                   TEXT,
  brand                 TEXT,
  category              TEXT,
  form                  TEXT,
  unit                  TEXT,
  "salePrice"             NUMERIC(15,2) DEFAULT 0,
  "purchasePrice"         NUMERIC(15,2) DEFAULT 0,
  tva                   NUMERIC(5,2)  DEFAULT 0,
  "minStock"              INTEGER DEFAULT 0,
  "requiresPrescription"  BOOLEAN DEFAULT FALSE,
  status                TEXT DEFAULT 'active',
  "supplierId"            BIGINT,
  rayon                 TEXT,
  notes                 TEXT,
  "expiryDate"            TEXT,
  "updatedAt"             BIGINT,
  "createdAt"             BIGINT,
  _synced               BOOLEAN DEFAULT FALSE
);

-- ──────────────────────────────────────────────────────────
-- 5. TABLE lots
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lots (
  id            BIGINT PRIMARY KEY,
  "productId"     BIGINT,
  "lotNumber"     TEXT,
  "expiryDate"    TEXT,
  quantity      INTEGER DEFAULT 0,
  "purchasePrice" NUMERIC(15,2) DEFAULT 0,
  "salePrice"     NUMERIC(15,2) DEFAULT 0,
  status        TEXT DEFAULT 'active',
  "updatedAt"     BIGINT,
  "createdAt"     BIGINT,
  _synced       BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_lots_productId  ON public.lots("productId");
CREATE INDEX IF NOT EXISTS idx_lots_expiryDate ON public.lots("expiryDate");

-- ──────────────────────────────────────────────────────────
-- 6. TABLE stock
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock (
  id          BIGINT PRIMARY KEY,
  "productId"   BIGINT UNIQUE,
  quantity    INTEGER DEFAULT 0,
  "updatedAt"   BIGINT,
  _synced     BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_stock_productId ON public.stock("productId");

-- ──────────────────────────────────────────────────────────
-- 7. TABLE movements
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.movements (
  id          BIGINT PRIMARY KEY,
  "productId"   BIGINT,
  "lotId"       BIGINT,
  type        TEXT,
  quantity    INTEGER DEFAULT 0,
  date        TEXT,
  reason      TEXT,
  "userId"      BIGINT,
  "saleId"      BIGINT,
  notes       TEXT,
  "updatedAt"   BIGINT,
  "createdAt"   BIGINT,
  _synced     BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_movements_productId ON public.movements("productId");
CREATE INDEX IF NOT EXISTS idx_movements_date      ON public.movements(date);
CREATE INDEX IF NOT EXISTS idx_movements_type      ON public.movements(type);

-- ──────────────────────────────────────────────────────────
-- 8. TABLE suppliers
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.suppliers (
  id          BIGINT PRIMARY KEY,
  name        TEXT NOT NULL,
  contact     TEXT,
  phone       TEXT,
  email       TEXT,
  address     TEXT,
  status      TEXT DEFAULT 'active',
  notes       TEXT,
  "updatedAt"   BIGINT,
  "createdAt"   BIGINT,
  _synced     BOOLEAN DEFAULT FALSE
);

-- ──────────────────────────────────────────────────────────
-- 9. TABLE "purchaseOrders"
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."purchaseOrders" (
  id            BIGINT PRIMARY KEY,
  "supplierId"    BIGINT,
  "orderNumber"   TEXT,
  date          TEXT,
  status        TEXT DEFAULT 'draft',
  total         NUMERIC(15,2) DEFAULT 0,
  paid          NUMERIC(15,2) DEFAULT 0,
  items         TEXT,
  notes         TEXT,
  "userId"        BIGINT,
  "updatedAt"     BIGINT,
  "createdAt"     BIGINT,
  _synced       BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_purchaseOrders_supplierId ON public."purchaseOrders"("supplierId");
CREATE INDEX IF NOT EXISTS idx_purchaseOrders_date       ON public."purchaseOrders"(date);
CREATE INDEX IF NOT EXISTS idx_purchaseOrders_status     ON public."purchaseOrders"(status);

-- ──────────────────────────────────────────────────────────
-- 10. TABLE patients
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.patients (
  id            BIGINT PRIMARY KEY,
  name          TEXT NOT NULL,
  phone         TEXT,
  address       TEXT,
  "birthDate"     TEXT,
  gender        TEXT,
  "creditLimit"   NUMERIC(15,2) DEFAULT 0,
  insurance     TEXT,
  notes         TEXT,
  "updatedAt"     BIGINT,
  "createdAt"     BIGINT,
  _synced       BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_patients_name  ON public.patients(name);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON public.patients(phone);

-- ──────────────────────────────────────────────────────────
-- 11. TABLE sales
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales (
  id              BIGINT PRIMARY KEY,
  "saleNumber"      TEXT,
  date            TEXT,
  "patientId"       BIGINT,
  "userId"          BIGINT,
  "paymentMethod"   TEXT,
  total           NUMERIC(15,2) DEFAULT 0,
  paid            NUMERIC(15,2) DEFAULT 0,
  discount        NUMERIC(15,2) DEFAULT 0,
  status          TEXT DEFAULT 'completed',
  notes           TEXT,
  "receiptData"     TEXT,
  "updatedAt"       BIGINT,
  "createdAt"     BIGINT,
  _synced         BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_sales_date          ON public.sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_patientId     ON public.sales("patientId");
CREATE INDEX IF NOT EXISTS idx_sales_userId        ON public.sales("userId");
CREATE INDEX IF NOT EXISTS idx_sales_paymentMethod ON public.sales("paymentMethod");
CREATE INDEX IF NOT EXISTS idx_sales_status        ON public.sales(status);

-- ──────────────────────────────────────────────────────────
-- 12. TABLE "saleItems"
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."saleItems" (
  id          BIGINT PRIMARY KEY,
  "saleId"      BIGINT,
  "productId"   BIGINT,
  "lotId"       BIGINT,
  name        TEXT,
  quantity    INTEGER DEFAULT 1,
  "unitPrice"   NUMERIC(15,2) DEFAULT 0,
  total       NUMERIC(15,2) DEFAULT 0,
  discount    NUMERIC(15,2) DEFAULT 0,
  "updatedAt"   BIGINT,
  _synced     BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_saleItems_saleId    ON public."saleItems"("saleId");
CREATE INDEX IF NOT EXISTS idx_saleItems_productId ON public."saleItems"("productId");

-- ──────────────────────────────────────────────────────────
-- 13. TABLE prescriptions
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id          BIGINT PRIMARY KEY,
  "patientId"   BIGINT,
  "doctorName"  TEXT,
  date        TEXT,
  status      TEXT DEFAULT 'active',
  items       TEXT,
  notes       TEXT,
  "updatedAt"   BIGINT,
  "createdAt"   BIGINT,
  _synced     BOOLEAN DEFAULT FALSE
);

-- ──────────────────────────────────────────────────────────
-- 14. TABLE alerts
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alerts (
  id          BIGINT PRIMARY KEY,
  type        TEXT,
  "productId"   BIGINT,
  "lotId"       BIGINT,
  message     TEXT,
  status      TEXT DEFAULT 'active',
  date        TEXT,
  "updatedAt"   BIGINT,
  _synced     BOOLEAN DEFAULT FALSE
);

-- ──────────────────────────────────────────────────────────
-- 15. TABLE "cashRegister"
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."cashRegister" (
  id          BIGINT PRIMARY KEY,
  date        TEXT,
  type        TEXT,
  amount      NUMERIC(15,2) DEFAULT 0,
  balance     NUMERIC(15,2) DEFAULT 0,
  description TEXT,
  "userId"      BIGINT,
  "saleId"      BIGINT,
  "updatedAt"   BIGINT,
  "createdAt"   BIGINT,
  _synced     BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_cashRegister_date ON public."cashRegister"(date);
CREATE INDEX IF NOT EXISTS idx_cashRegister_type ON public."cashRegister"(type);

-- ──────────────────────────────────────────────────────────
-- 16. TABLE returns
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.returns (
  id          BIGINT PRIMARY KEY,
  "saleId"      BIGINT,
  "patientId"   BIGINT,
  "userId"      BIGINT,
  date        TEXT,
  status      TEXT DEFAULT 'pending',
  items       TEXT,
  total       NUMERIC(15,2) DEFAULT 0,
  reason      TEXT,
  notes       TEXT,
  "updatedAt"   BIGINT,
  "createdAt"   BIGINT,
  _synced     BOOLEAN DEFAULT FALSE
);

-- ──────────────────────────────────────────────────────────
-- 17. TABLE invoices
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
  id            BIGINT PRIMARY KEY,
  "invoiceNumber" TEXT,
  "supplierId"    BIGINT,
  date          TEXT,
  "dueDate"       TEXT,
  status        TEXT DEFAULT 'draft',
  total         NUMERIC(15,2) DEFAULT 0,
  paid          NUMERIC(15,2) DEFAULT 0,
  items         TEXT,
  notes         TEXT,
  "userId"        BIGINT,
  "updatedAt"     BIGINT,
  "createdAt"     BIGINT,
  _synced       BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_invoices_supplierId ON public.invoices("supplierId");
CREATE INDEX IF NOT EXISTS idx_invoices_date       ON public.invoices(date);
CREATE INDEX IF NOT EXISTS idx_invoices_status     ON public.invoices(status);

-- ──────────────────────────────────────────────────────────
-- 18. TABLE shifts
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shifts (
  id          TEXT PRIMARY KEY,
  date        TEXT,
  type        TEXT,
  status      TEXT DEFAULT 'open',
  "managerId"   BIGINT,
  "startTime"   TEXT,
  "endTime"     TEXT,
  "totalSales"  NUMERIC(15,2) DEFAULT 0,
  notes       TEXT,
  "updatedAt"   BIGINT,
  "createdAt"   BIGINT,
  _synced     BOOLEAN DEFAULT FALSE
);

-- ──────────────────────────────────────────────────────────
-- 19. TABLE inventories
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventories (
  id          BIGINT PRIMARY KEY,
  date        TEXT,
  "userId"      BIGINT,
  status      TEXT DEFAULT 'draft',
  notes       TEXT,
  "updatedAt"   BIGINT,
  "createdAt"   BIGINT,
  _synced     BOOLEAN DEFAULT FALSE
);

-- ──────────────────────────────────────────────────────────
-- 20. TABLE "inventoryAdjustments"
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."inventoryAdjustments" (
  id              BIGINT PRIMARY KEY,
  "inventoryId"     BIGINT,
  "productId"       BIGINT,
  "lotId"           BIGINT,
  "expectedQty"     INTEGER DEFAULT 0,
  "countedQty"      INTEGER DEFAULT 0,
  difference      INTEGER DEFAULT 0,
  date            TEXT,
  "userId"          BIGINT,
  notes           TEXT,
  "updatedAt"       BIGINT,
  "createdAt"       BIGINT,
  _synced         BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_inventoryAdj_inventoryId ON public."inventoryAdjustments"("inventoryId");
CREATE INDEX IF NOT EXISTS idx_inventoryAdj_productId   ON public."inventoryAdjustments"("productId");

-- ──────────────────────────────────────────────────────────
-- 21. TABLE "auditLog"
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."auditLog" (
  id          BIGINT PRIMARY KEY,
  "userId"      BIGINT,
  username    TEXT,
  action      TEXT,
  store       TEXT,
  "recordId"    TEXT,
  data        TEXT,
  timestamp   BIGINT,
  "ipAddress"   TEXT,
  "updatedAt"   BIGINT,
  _synced     BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_auditLog_userId    ON public."auditLog"("userId");
CREATE INDEX IF NOT EXISTS idx_auditLog_action    ON public."auditLog"(action);
CREATE INDEX IF NOT EXISTS idx_auditLog_timestamp ON public."auditLog"(timestamp);

-- ──────────────────────────────────────────────────────────
-- 22. TABLE employees (RH)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employees (
  id               BIGINT PRIMARY KEY,
  nom              TEXT NOT NULL,
  name             TEXT,
  poste            TEXT,
  department       TEXT,
  "dateEmbauche"     TEXT,
  "dateNaissance"    TEXT,
  salaire          NUMERIC(15,2) DEFAULT 0,
  "typeContrat"      TEXT,
  "dateFinContrat"   TEXT,
  telephone        TEXT,
  cni              TEXT,
  adresse          TEXT,
  "contactUrgence"   TEXT,
  status           TEXT DEFAULT 'actif',
  active           BOOLEAN DEFAULT TRUE,
  notes            TEXT,
  "userId"           BIGINT,
  "updatedAt"        BIGINT,
  "createdAt"        BIGINT,
  _synced          BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_employees_status     ON public.employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_department ON public.employees(department);

-- ──────────────────────────────────────────────────────────
-- 23. TABLE "hr_payroll"
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."hr_payroll" (
  id           BIGINT PRIMARY KEY,
  "employeeId"   BIGINT,
  period       TEXT,
  "baseSalary"   NUMERIC(15,2) DEFAULT 0,
  bonuses      NUMERIC(15,2) DEFAULT 0,
  deductions   NUMERIC(15,2) DEFAULT 0,
  "netSalary"    NUMERIC(15,2) DEFAULT 0,
  status       TEXT DEFAULT 'draft',
  "paidAt"       TEXT,
  notes        TEXT,
  "userId"       BIGINT,
  "updatedAt"    BIGINT,
  "createdAt"    BIGINT,
  _synced      BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_hr_payroll_employeeId ON public."hr_payroll"("employeeId");
CREATE INDEX IF NOT EXISTS idx_hr_payroll_period     ON public."hr_payroll"(period);

-- ──────────────────────────────────────────────────────────
-- 24. TABLE "hr_advances"
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."hr_advances" (
  id           BIGINT PRIMARY KEY,
  "employeeId"   BIGINT,
  amount       NUMERIC(15,2) DEFAULT 0,
  date         TEXT,
  reason       TEXT,
  status       TEXT DEFAULT 'pending',
  "approvedBy"   BIGINT,
  notes        TEXT,
  "updatedAt"    BIGINT,
  "createdAt"    BIGINT,
  _synced      BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_hr_advances_employeeId ON public."hr_advances"("employeeId");

-- ──────────────────────────────────────────────────────────
-- 25. TABLE "hr_leaves"
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."hr_leaves" (
  id           BIGINT PRIMARY KEY,
  "employeeId"   BIGINT,
  type         TEXT,
  "startDate"    TEXT,
  "endDate"      TEXT,
  days         INTEGER DEFAULT 0,
  reason       TEXT,
  status       TEXT DEFAULT 'pending',
  "approvedBy"   BIGINT,
  notes        TEXT,
  "updatedAt"    BIGINT,
  "createdAt"    BIGINT,
  _synced      BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_hr_leaves_employeeId ON public."hr_leaves"("employeeId");
CREATE INDEX IF NOT EXISTS idx_hr_leaves_status     ON public."hr_leaves"(status);

-- ──────────────────────────────────────────────────────────
-- 26. TABLE "hr_attendance"
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."hr_attendance" (
  id           BIGINT PRIMARY KEY,
  "employeeId"   BIGINT,
  date         TEXT,
  "checkIn"      TEXT,
  "checkOut"     TEXT,
  status       TEXT DEFAULT 'present',
  notes        TEXT,
  "updatedAt"    BIGINT,
  "createdAt"    BIGINT,
  _synced      BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_employeeId ON public."hr_attendance"("employeeId");
CREATE INDEX IF NOT EXISTS idx_hr_attendance_date       ON public."hr_attendance"(date);

-- ──────────────────────────────────────────────────────────
-- 27. DÉSACTIVER RLS sur toutes les tables
-- ──────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.app_users              DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.settings               DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products               DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lots                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stock                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.movements              DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.suppliers              DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."purchaseOrders"       DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.patients               DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sales                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."saleItems"            DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.prescriptions          DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.alerts                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."cashRegister"         DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.returns                DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoices               DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shifts                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventories            DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."inventoryAdjustments" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."auditLog"             DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.employees              DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."hr_payroll"           DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."hr_advances"          DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."hr_leaves"            DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."hr_attendance"        DISABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────
-- ✅ Script terminé — Aucune donnée supprimée ou modifiée
-- ──────────────────────────────────────────────────────────
SELECT 'OrdiveX schema v9 camelCase installé avec succès' AS result;
-- Ajouter les colonnes de prix manquantes dans la table lots
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS "purchasePrice" NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS "salePrice" NUMERIC(15,2) DEFAULT 0;