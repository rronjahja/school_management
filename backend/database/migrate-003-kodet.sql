-- ---------------------------------------------------------------
-- Migrimi 003: kodet e drejtimeve (perdoren te nr. i kontrates)
-- Run:  mysql -u root -p ispe_school < database/migrate-003-kodet.sql
-- ---------------------------------------------------------------

USE ispe_school;

-- E domosdoshme: pa kete, shkronjat shqipe (ë, ç) prishen gjate importimit
SET NAMES utf8mb4;

-- E nevojshme per MySQL Workbench (safe update mode bllokon UPDATE pa celes)
SET SQL_SAFE_UPDATES = 0;

-- Riparon emrat e drejtimeve nese jane importuar me kodim te gabuar
-- (p.sh. 'InformatikÃ«' -> 'Informatikë').
-- 'C383' eshte gjurma e sigurt e kodimit te dyfishte; nese nuk ekziston,
-- kjo komande nuk prek asgje — pra mund te ekzekutohet pa rrezik.
UPDATE categories
   SET name = CONVERT(BINARY(CONVERT(name USING latin1)) USING utf8mb4)
 WHERE HEX(name) LIKE '%C383%'
   AND CONVERT(BINARY(CONVERT(name USING latin1)) USING utf8mb4) IS NOT NULL;

UPDATE categories SET code = 'TD' WHERE name = 'Teknik Dentar';
UPDATE categories SET code = 'TF' WHERE name = 'Farmaci';
UPDATE categories SET code = 'AF' WHERE name = 'Fizioterapi';

-- Kodet e mëposhtme janë hamendje — ndryshojini sipas nevojës
UPDATE categories SET code = 'AI' WHERE name = 'Infermieri';
UPDATE categories SET code = 'TI' WHERE name = 'Informatikë';

SELECT id, name, code FROM categories ORDER BY id;

SET SQL_SAFE_UPDATES = 1;
