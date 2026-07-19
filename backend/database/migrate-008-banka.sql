-- ---------------------------------------------------------------
-- Migrimi 008: numrat e llogarive bankare në bazë (jo në kod)
-- Rikujtesa e pagesës i merr llogaritë nga tabela `banks`.
-- Run:  mysql -u root -p ispe_school < database/migrate-008-banka.sql
-- ---------------------------------------------------------------

USE ispe_school;

SET NAMES utf8mb4;
SET SQL_SAFE_UPDATES = 0;

ALTER TABLE banks
  ADD COLUMN account_number VARCHAR(40) DEFAULT NULL AFTER name;

-- Llogaritë e njohura nga kontrata. LIKE mbulon emërtimet
-- 'TEB' / 'TEB Bank' etj. Nuk prek llogari të vendosura tashmë.
UPDATE banks SET account_number = '2011 0000 2024 7044'
 WHERE name LIKE 'TEB%' AND account_number IS NULL;
UPDATE banks SET account_number = '1501 1500 0091 7205'
 WHERE name LIKE 'Raiffeisen%' AND account_number IS NULL;

SELECT id, name, account_number FROM banks ORDER BY id;

SET SQL_SAFE_UPDATES = 1;
