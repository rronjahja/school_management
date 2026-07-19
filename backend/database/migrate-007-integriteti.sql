-- ---------------------------------------------------------------
-- Migrimi 007: integriteti i të dhënave financiare
--   1. Mbush vitin shkollor te këstet ku mungon
--   2. Ndalon numrat e dyfishtë të kontratës
-- Run:  mysql -u root -p ispe_school < database/migrate-007-integriteti.sql
-- ---------------------------------------------------------------

USE ispe_school;

SET NAMES utf8mb4;
SET SQL_SAFE_UPDATES = 0;

-- 1. Këstet e krijuara para këtij rregullimi nuk kanë vit shkollor.
--    Këto i takojnë vitit të PARË të regjistruar të studentit: nëse ka
--    historik, marrim vitin më të hershëm; përndryshe vitin aktual.
UPDATE installments i
  JOIN students s ON s.id = i.student_id
  LEFT JOIN (
    SELECT student_id, MIN(generation) AS first_gen
      FROM student_year_history GROUP BY student_id
  ) h ON h.student_id = i.student_id
   SET i.generation = COALESCE(h.first_gen, s.generation)
 WHERE i.generation IS NULL;

SELECT COUNT(*) AS keste_pa_vit_te_mbetura FROM installments WHERE generation IS NULL;

-- 2. Numrat e dyfishtë të kontratës, nëse ekzistojnë, duhen zgjidhur para hapit 3
SELECT contract_number, COUNT(*) AS here
  FROM students
 WHERE contract_number IS NOT NULL
 GROUP BY contract_number HAVING COUNT(*) > 1;

-- 3. Nga tani, baza e të dhënave nuk lejon numra kontrate të përsëritur.
--    Nëse kjo komandë dështon, zgjidhni fillimisht dublikatat e listuara më sipër.
ALTER TABLE students
  ADD CONSTRAINT uq_students_contract_number UNIQUE (contract_number);

SET SQL_SAFE_UPDATES = 1;
