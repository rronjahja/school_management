-- ---------------------------------------------------------------
-- Migrimi 002: fushat e kontratës + planet e reja të pagesës
-- Për bazat EKZISTUESE. (Instalimet e reja: mjafton schema.sql)
-- Run:  mysql -u root -p ispe_school < database/migrate-002-kontrata.sql
-- ---------------------------------------------------------------

USE ispe_school;

SET NAMES utf8mb4;

-- E nevojshme per MySQL Workbench (safe update mode bllokon UPDATE pa celes)
SET SQL_SAFE_UPDATES = 0;

-- 1. Kodi i drejtimit (për nr. e kontratës, p.sh. 22/2025/TF)
ALTER TABLE categories
  ADD COLUMN code VARCHAR(6) NOT NULL DEFAULT '' AFTER name;

UPDATE categories SET code = 'TD' WHERE name = 'Teknik Dentar';
UPDATE categories SET code = 'TF' WHERE name = 'Farmaci';
UPDATE categories SET code = 'FT' WHERE name = 'Fizioterapi';
UPDATE categories SET code = 'IN' WHERE name = 'Infermieri';
UPDATE categories SET code = 'IT' WHERE name = 'Informatikë';

-- 2. Fushat e reja të studentit (nga kontrata)
ALTER TABLE students
  ADD COLUMN email VARCHAR(120) DEFAULT NULL AFTER phone,
  ADD COLUMN citizenship VARCHAR(60) DEFAULT NULL AFTER email,
  ADD COLUMN nationality VARCHAR(60) DEFAULT NULL AFTER citizenship,
  ADD COLUMN mother_last_name VARCHAR(80) DEFAULT NULL AFTER mother_name,
  ADD COLUMN mother_birthday DATE DEFAULT NULL AFTER mother_last_name,
  ADD COLUMN father_last_name VARCHAR(80) DEFAULT NULL AFTER father_name,
  ADD COLUMN guardian_personal_id VARCHAR(20) DEFAULT NULL AFTER father_last_name,
  ADD COLUMN guardian_phone VARCHAR(30) DEFAULT NULL AFTER guardian_personal_id,
  ADD COLUMN guardian_email VARCHAR(120) DEFAULT NULL AFTER guardian_phone,
  ADD COLUMN contract_number VARCHAR(30) DEFAULT NULL AFTER category_id;

-- 3. Planet e reja të pagesës (Neni 6 i kontratës)
--    Hapi A: zgjërojmë ENUM-in me vlerat e vjetra + të rejat
ALTER TABLE students
  MODIFY payment_plan
  ENUM('monthly','semiannual','annual','immediate','two','four','six')
  NOT NULL DEFAULT 'monthly';

--    Hapi B: përkthejmë planet e vjetra në më të afërtat e reja
UPDATE students SET payment_plan = 'two'       WHERE payment_plan = 'semiannual';
UPDATE students SET payment_plan = 'immediate' WHERE payment_plan = 'annual';
-- 'monthly' mbetet 'monthly' (tani 12 muaj në vend të 10)

--    Hapi C: heqim vlerat e vjetra
ALTER TABLE students
  MODIFY payment_plan
  ENUM('immediate','two','four','six','monthly')
  NOT NULL DEFAULT 'monthly';

-- 4. VËMENDJE: pas migrimit, këstet ekzistuese janë sipas planeve të vjetra.
-- Për t'i rigjeneruar sipas rregullave të reja, hapni studentin në aplikacion
-- te "Ndrysho" dhe klikoni "Ruaj ndryshimet" (mjafton edhe pa ndryshuar gjë,
-- nëse ndryshoni planin dhe e ktheni). Pagesat e regjistruara ruhen gjithmonë.

SET SQL_SAFE_UPDATES = 1;
