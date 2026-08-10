-- ---------------------------------------------------------------
-- Migrimi 032: fjalëkalimi i parë vendoset nga vetë përdoruesi
--
--   Deri tani, fjalëkalimin që shkruante administratori te «Shto
--   përdorues» e mbante përdoruesi për sa kohë të donte. Domethënë çdo
--   llogari kishte një fjalëkalim që e dinin dy veta — dhe në ditarin e
--   veprimeve nuk dallohej dot më kush e bëri vërtet një veprim.
--
--   Tani fjalëkalimi i dhënë nga administratori është i PËRKOHSHËM:
--
--     · administratori krijon llogarinë  -> must_change_password = 1
--     · administratori jep fjalëkalim të ri -> must_change_password = 1
--     · përdoruesi vendos të tijin       -> must_change_password = 0
--
--   Derisa flamuri të jetë 1, serveri (requireAuth) lejon vetëm
--   /auth/me, /auth/change-password dhe /auth/logout. Ndalesa është në
--   server e jo në ekran: përndryshe mjaftonte një thirrje e drejtpërdrejtë
--   e API-t për ta anashkaluar.
--
--   LLOGARITË EKZISTUESE NUK PREKEN: parazgjedhja është 0, ndaj askush
--   nuk detyrohet të ndryshojë asgjë pas këtij migrimi. Rregulli vlen
--   vetëm për llogaritë e krijuara ose të rivendosura nga tani e tutje.
--
-- Run:  mysql -u root -p ispe_school < database/migrate-032-fjalekalimi-i-pare.sql
--       (ose kopjojeni te phpMyAdmin -> SQL)
-- ---------------------------------------------------------------

USE ispe_school;

SET NAMES utf8mb4;
SET SQL_SAFE_UPDATES = 0;

-- E sigurt të ekzekutohet dy herë: shtohet vetëm nëse kolona mungon.
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'users'
     AND COLUMN_NAME  = 'must_change_password'
);
SET @sql := IF(@has_col = 0,
  'ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active',
  'SELECT ''must_change_password ekziston tashmë'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------
-- OPSIONALE — hiqni komentin nëse doni që TË GJITHË përdoruesit
-- ekzistues (përveç jush) ta vendosin fjalëkalimin e tyre në hyrjen e
-- ardhshme. Kjo është e këshillueshme nëse fjalëkalimet e tanishme i ka
-- caktuar administratori. Zëvendësoni 'admini_juaj' me emrin tuaj.
-- ---------------------------------------------------------------
-- UPDATE users
--    SET must_change_password = 1
--  WHERE is_active = 1
--    AND username <> 'admini_juaj';

-- Kontroll
SELECT username, full_name, role, is_active, must_change_password
  FROM users
 ORDER BY must_change_password DESC, username;

SET SQL_SAFE_UPDATES = 1;