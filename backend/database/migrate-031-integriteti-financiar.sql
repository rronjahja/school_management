-- ---------------------------------------------------------------
-- Migrimi 031: integriteti financiar — diagnostikë + mbrojtje
--
--   Ky migrim NUK ndryshon asnjë shifër. Ai bën dy gjëra:
--
--     A) DIAGNOSTIKË — tregon çfarë ka lënë pas gabimi i kalimit të
--        vitit (zbritja e vitit të kaluar mbetej në këstet e vitit të
--        ri) dhe gabimi i përditësimit të nxënësit (kuota ruhej ndryshe
--        nga këstet). Asgjë nuk preket: vetëm listohet.
--
--     B) MBROJTJE — vendos kufizimet që i mungojnë bazës nëse migrimet
--        005 dhe 007 nuk janë ekzekutuar ndonjëherë. Të gjitha janë të
--        SIGURTA për t'u ekzekutuar dy herë: nëse ekzistojnë tashmë,
--        nuk bëhet asgjë.
--
--   Riparimi i shifrave NUK bëhet me SQL: datat e kësteve varen nga
--   plani i pagesës dhe nga kalendari i vitit shkollor, të cilat i di
--   vetëm `buildInstallments`. Përdorni:
--
--       cd backend && node scripts/repair-installments.js          (parapamje)
--       cd backend && node scripts/repair-installments.js --apply  (ndreqja)
--
-- Run:  mysql -u root -p ispe_school < database/migrate-031-integriteti-financiar.sql
--       (ose kopjojeni te phpMyAdmin -> SQL)
-- ---------------------------------------------------------------

USE ispe_school;

SET NAMES utf8mb4;
SET SQL_SAFE_UPDATES = 0;

-- ═══════════════════════════════════════════════════════════════
--  A) DIAGNOSTIKË — vetëm lexim
-- ═══════════════════════════════════════════════════════════════

-- A1. Nxënësit ku SHUMA E KËSTEVE nuk përputhet me kuotën neto.
--
--     Kolona `duhet` është kuota neto sipas rreshtit të nxënësit.
--     Kolona `keste_viti` është ajo që ndodhet vërtet te `installments`.
--     Çdo rresht që del këtu duhet ndrequr me skriptin e mësipërm.
--
--     Shkaku më i shpeshtë: nxënësi u promovua ndërsa kishte zbritje —
--     zbritja u hoq nga rreshti, por mbeti brenda kësteve.
SELECT
    s.id,
    s.first_name,
    s.last_name,
    s.generation,
    s.study_year,
    s.payment_plan,
    s.yearly_quota,
    s.discount_type,
    s.discount_value,
    ROUND(CASE s.discount_type
            WHEN 'percent' THEN s.yearly_quota * (1 - s.discount_value / 100)
            WHEN 'amount'  THEN s.yearly_quota - s.discount_value
            ELSE s.yearly_quota
          END, 2)                                                        AS duhet,
    ROUND(SUM(CASE WHEN i.is_carryover = 0 THEN i.amount ELSE 0 END), 2) AS keste_viti,
    ROUND(SUM(CASE WHEN i.is_carryover = 1 THEN i.amount ELSE 0 END), 2) AS borxh_bartur
  FROM students s
  JOIN installments i ON i.student_id = s.id
 WHERE s.status = 'active'
 GROUP BY s.id
HAVING ABS(keste_viti - duhet) > 0.01
 ORDER BY ABS(keste_viti - duhet) DESC;

-- A2. Këste pa vit shkollor. Nëse kjo kthen më shumë se 0, migrimi 007
--     nuk është ekzekutuar kurrë — hapi B1 më poshtë e ndreq.
SELECT COUNT(*) AS keste_pa_vit FROM installments WHERE generation IS NULL;

-- A3. Numra kontrate të përsëritur. Duhen zgjidhur me dorë PARA hapit B2,
--     përndryshe ai dështon. Nëse kthen bosh, gjithçka është në rregull.
SELECT contract_number, COUNT(*) AS here
  FROM students
 WHERE contract_number IS NOT NULL
 GROUP BY contract_number
HAVING COUNT(*) > 1;

-- A4. Paralele dhe lëndë që do të merrnin me vete orë mësimi po të
--     fshiheshin. Kodi tani i ndalon, por kjo tregon sa është rreziku
--     nëse dikush fshin drejtpërdrejt nga phpMyAdmin.
SELECT 'paralele me orë' AS lloji, COUNT(DISTINCT class_id)   AS sa FROM lessons
UNION ALL
SELECT 'lëndë me orë',           COUNT(DISTINCT subject_id)   FROM lessons;

-- ═══════════════════════════════════════════════════════════════
--  B) MBROJTJE — e sigurt të ekzekutohet sa herë të doni
-- ═══════════════════════════════════════════════════════════════

-- B1. Këstet pa vit shkollor marrin vitin e nxënësit (si te migrimi 007).
--     Pa këtë, përditësimi i nxënësit nuk arrin t'i fshijë dhe këstet e
--     reja shtohen PAS tyre — borxhi dyfishohet në heshtje.
UPDATE installments i
  JOIN students s ON s.id = i.student_id
  LEFT JOIN (
    SELECT student_id, MIN(generation) AS first_gen
      FROM student_year_history GROUP BY student_id
  ) h ON h.student_id = i.student_id
   SET i.generation = COALESCE(h.first_gen, s.generation)
 WHERE i.generation IS NULL;

-- B2. Numri i kontratës duhet të jetë unik NË BAZË, jo vetëm në kod:
--     dy regjistrime njëkohësisht e kalojnë kontrollin e aplikacionit.
--     Shtohet vetëm nëse mungon (migrimi 007 mund ta ketë vendosur tashmë).
SET @has_uq := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'students'
     AND INDEX_NAME   = 'uq_students_contract_number'
);
SET @sql := IF(@has_uq = 0,
  'ALTER TABLE students ADD CONSTRAINT uq_students_contract_number UNIQUE (contract_number)',
  'SELECT ''uq_students_contract_number ekziston tashmë'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- B3. Këstet lexohen e fshihen sipas vitit shkollor në çdo përditësim
--     nxënësi dhe në çdo kalim viti. Pa indeks, secili skanon tabelën.
SET @has_idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'installments'
     AND INDEX_NAME   = 'idx_installments_generation'
);
SET @sql := IF(@has_idx = 0,
  'CREATE INDEX idx_installments_generation ON installments (generation)',
  'SELECT ''idx_installments_generation ekziston tashmë'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ═══════════════════════════════════════════════════════════════
--  Kontrolli përfundimtar
-- ═══════════════════════════════════════════════════════════════
SELECT COUNT(*) AS keste_pa_vit_te_mbetura FROM installments WHERE generation IS NULL;

SELECT INDEX_NAME, NON_UNIQUE
  FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME IN ('students', 'installments')
   AND INDEX_NAME IN ('uq_students_contract_number', 'idx_installments_generation')
 GROUP BY INDEX_NAME, NON_UNIQUE;

SET SQL_SAFE_UPDATES = 1;