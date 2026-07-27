-- ============================================================
-- OrdiveX v9 — Script SQL Supabase : Activation RLS + Policies d'Accès
-- Exécuter dans : Supabase → SQL Editor → New Query
-- ✅ Active le RLS sur les 25 tables
-- ✅ Crée des règles d'accès complet universelles (CamelCase Safe)
-- ✅ Évite les erreurs de duplication de règles
-- ============================================================

-- 1. app_users
ALTER TABLE IF EXISTS public.app_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_users_full_access" ON public.app_users;
CREATE POLICY "app_users_full_access" ON public.app_users FOR ALL USING (true) WITH CHECK (true);

-- 2. settings
ALTER TABLE IF EXISTS public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_full_access" ON public.settings;
CREATE POLICY "settings_full_access" ON public.settings FOR ALL USING (true) WITH CHECK (true);

-- 3. products
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_full_access" ON public.products;
CREATE POLICY "products_full_access" ON public.products FOR ALL USING (true) WITH CHECK (true);

-- 4. lots
ALTER TABLE IF EXISTS public.lots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lots_full_access" ON public.lots;
CREATE POLICY "lots_full_access" ON public.lots FOR ALL USING (true) WITH CHECK (true);

-- 5. stock
ALTER TABLE IF EXISTS public.stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stock_full_access" ON public.stock;
CREATE POLICY "stock_full_access" ON public.stock FOR ALL USING (true) WITH CHECK (true);

-- 6. movements
ALTER TABLE IF EXISTS public.movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "movements_full_access" ON public.movements;
CREATE POLICY "movements_full_access" ON public.movements FOR ALL USING (true) WITH CHECK (true);

-- 7. suppliers
ALTER TABLE IF EXISTS public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "suppliers_full_access" ON public.suppliers;
CREATE POLICY "suppliers_full_access" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);

-- 8. purchaseOrders
ALTER TABLE IF EXISTS public."purchaseOrders" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purchaseOrders_full_access" ON public."purchaseOrders";
CREATE POLICY "purchaseOrders_full_access" ON public."purchaseOrders" FOR ALL USING (true) WITH CHECK (true);

-- 9. patients
ALTER TABLE IF EXISTS public.patients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "patients_full_access" ON public.patients;
CREATE POLICY "patients_full_access" ON public.patients FOR ALL USING (true) WITH CHECK (true);

-- 10. sales
ALTER TABLE IF EXISTS public.sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sales_full_access" ON public.sales;
CREATE POLICY "sales_full_access" ON public.sales FOR ALL USING (true) WITH CHECK (true);

-- 11. saleItems
ALTER TABLE IF EXISTS public."saleItems" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saleItems_full_access" ON public."saleItems";
CREATE POLICY "saleItems_full_access" ON public."saleItems" FOR ALL USING (true) WITH CHECK (true);

-- 12. prescriptions
ALTER TABLE IF EXISTS public.prescriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prescriptions_full_access" ON public.prescriptions;
CREATE POLICY "prescriptions_full_access" ON public.prescriptions FOR ALL USING (true) WITH CHECK (true);

-- 13. alerts
ALTER TABLE IF EXISTS public.alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "alerts_full_access" ON public.alerts;
CREATE POLICY "alerts_full_access" ON public.alerts FOR ALL USING (true) WITH CHECK (true);

-- 14. cashRegister
ALTER TABLE IF EXISTS public."cashRegister" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cashRegister_full_access" ON public."cashRegister";
CREATE POLICY "cashRegister_full_access" ON public."cashRegister" FOR ALL USING (true) WITH CHECK (true);

-- 15. returns
ALTER TABLE IF EXISTS public.returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "returns_full_access" ON public.returns;
CREATE POLICY "returns_full_access" ON public.returns FOR ALL USING (true) WITH CHECK (true);

-- 16. invoices
ALTER TABLE IF EXISTS public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoices_full_access" ON public.invoices;
CREATE POLICY "invoices_full_access" ON public.invoices FOR ALL USING (true) WITH CHECK (true);

-- 17. shifts
ALTER TABLE IF EXISTS public.shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shifts_full_access" ON public.shifts;
CREATE POLICY "shifts_full_access" ON public.shifts FOR ALL USING (true) WITH CHECK (true);

-- 18. inventories
ALTER TABLE IF EXISTS public.inventories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventories_full_access" ON public.inventories;
CREATE POLICY "inventories_full_access" ON public.inventories FOR ALL USING (true) WITH CHECK (true);

-- 19. inventoryAdjustments
ALTER TABLE IF EXISTS public."inventoryAdjustments" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventoryAdjustments_full_access" ON public."inventoryAdjustments";
CREATE POLICY "inventoryAdjustments_full_access" ON public."inventoryAdjustments" FOR ALL USING (true) WITH CHECK (true);

-- 20. auditLog
ALTER TABLE IF EXISTS public."auditLog" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auditLog_full_access" ON public."auditLog";
CREATE POLICY "auditLog_full_access" ON public."auditLog" FOR ALL USING (true) WITH CHECK (true);

-- 21. employees
ALTER TABLE IF EXISTS public.employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "employees_full_access" ON public.employees;
CREATE POLICY "employees_full_access" ON public.employees FOR ALL USING (true) WITH CHECK (true);

-- 22. hr_payroll
ALTER TABLE IF EXISTS public."hr_payroll" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hr_payroll_full_access" ON public."hr_payroll";
CREATE POLICY "hr_payroll_full_access" ON public."hr_payroll" FOR ALL USING (true) WITH CHECK (true);

-- 23. hr_advances
ALTER TABLE IF EXISTS public."hr_advances" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hr_advances_full_access" ON public."hr_advances";
CREATE POLICY "hr_advances_full_access" ON public."hr_advances" FOR ALL USING (true) WITH CHECK (true);

-- 24. hr_leaves
ALTER TABLE IF EXISTS public."hr_leaves" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hr_leaves_full_access" ON public."hr_leaves";
CREATE POLICY "hr_leaves_full_access" ON public."hr_leaves" FOR ALL USING (true) WITH CHECK (true);

-- 25. hr_attendance
ALTER TABLE IF EXISTS public."hr_attendance" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hr_attendance_full_access" ON public."hr_attendance";
CREATE POLICY "hr_attendance_full_access" ON public."hr_attendance" FOR ALL USING (true) WITH CHECK (true);

-- ──────────────────────────────────────────────────────────
-- ✅ Script terminé — RLS activé proprement avec accès total
-- ──────────────────────────────────────────────────────────
SELECT 'RLS activé et configuré avec succès sur les 25 tables' AS result;
