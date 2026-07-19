-- ---------------------------------------------------------------
-- Migrimi 004: viti i studimit (Viti I / II / III)
-- Run:  mysql -u root -p ispe_school < database/migrate-004-viti-studimit.sql
-- ---------------------------------------------------------------

USE ispe_school;

SET NAMES utf8mb4;

-- E nevojshme per MySQL Workbench (safe update mode bllokon UPDATE pa celes)
SET SQL_SAFE_UPDATES = 0;

ALTER TABLE students
  ADD COLUMN study_year TINYINT NOT NULL DEFAULT 1 AFTER class_name;

-- Mbushim vitin nga klasa ekzistuese: X -> 1, XI -> 2, XII -> 3
UPDATE students SET study_year = 3 WHERE class_name LIKE 'XII%';
UPDATE students SET study_year = 2 WHERE class_name LIKE 'XI%' AND class_name NOT LIKE 'XII%';
UPDATE students SET study_year = 1 WHERE class_name LIKE 'X%' AND class_name NOT LIKE 'XI%';

CREATE INDEX idx_students_study_year ON students (study_year);

SELECT study_year, COUNT(*) AS studente FROM students GROUP BY study_year ORDER BY study_year;

SET SQL_SAFE_UPDATES = 1;
