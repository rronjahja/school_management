-- ---------------------------------------------------------------
-- Migrimi 028: katalogu i lëndëve + lidhja profesor ↔ lëndë
--
--   Deri tani «lënda» ekzistonte vetëm si rresht brenda një paraleleje
--   (class_subjects): e njëjta «Matematikë» përsëritej për çdo paralele
--   si e dhënë më vete. Kjo mjaftonte për notat, por jo për të thënë
--   «Besniku jep Matematikë», sepse s'kishte një Matematikë të vetme
--   me të cilën ta lidhje.
--
--   Prandaj krijohet katalogu `subjects` — një rresht për çdo lëndë të
--   shkollës — dhe lidhja shumë-me-shumë `professor_subjects`:
--     · një profesor jep disa lëndë
--     · një lëndë jepet nga disa profesorë (zakonisht 2–3)
--
--   `class_subjects` merr një lidhje drejt katalogut, të mbushur sipas
--   emrit. Ruhet ashtu si është: notat ekzistuese nuk preken fare.
--
-- Run:  mysql -u root -p ispe_school < database/migrate-028-profesoret-lendet.sql
-- ---------------------------------------------------------------

USE ispe_school;

SET NAMES utf8mb4;
SET SQL_SAFE_UPDATES = 0;

-- 1. Katalogu i lëndëve
CREATE TABLE IF NOT EXISTS subjects (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(80) NOT NULL,
  grp        ENUM('gjuhet','matematika','shkencat','shoqeria','sportet',
                  'teknologjia','teorike','praktike') NOT NULL DEFAULT 'teorike',
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_subject_name UNIQUE (name)
) ENGINE = InnoDB;

-- 2. Mbushet nga lëndët që janë tashmë në përdorim nëpër paralele
INSERT IGNORE INTO subjects (name, grp)
SELECT TRIM(name), grp
  FROM class_subjects
 WHERE TRIM(name) <> ''
 GROUP BY TRIM(name), grp;

-- 3. Lidhja profesor ↔ lëndë
CREATE TABLE IF NOT EXISTS professor_subjects (
  professor_id INT NOT NULL,
  subject_id   INT NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (professor_id, subject_id),
  CONSTRAINT fk_ps_professor FOREIGN KEY (professor_id) REFERENCES users (id)    ON DELETE CASCADE,
  CONSTRAINT fk_ps_subject   FOREIGN KEY (subject_id)   REFERENCES subjects (id) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE INDEX idx_ps_subject ON professor_subjects (subject_id);

-- 4. Lënda e paraleles tregon drejt katalogut (mbushet sipas emrit)
ALTER TABLE class_subjects
  ADD COLUMN subject_id INT DEFAULT NULL AFTER class_id,
  ADD CONSTRAINT fk_cs_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE SET NULL;

UPDATE class_subjects cs
  JOIN subjects s ON s.name = TRIM(cs.name)
   SET cs.subject_id = s.id;

-- Kontroll: lëndë paralelesh që s'u lidhën dot (duhet të dalë bosh)
SELECT cs.id, cs.class_id, cs.name
  FROM class_subjects cs
 WHERE cs.subject_id IS NULL;

SELECT COUNT(*) AS lende_ne_katalog FROM subjects;

SET SQL_SAFE_UPDATES = 1;