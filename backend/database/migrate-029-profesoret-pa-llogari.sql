-- ---------------------------------------------------------------
-- Migrimi 029: profesorët nuk janë përdorues të sistemit
--
--   Profesorët nuk kyçen askund: orët e mësimit i bart dikush nga
--   administrata, nga ditari fizik në atë dixhital. Prandaj profesori
--   nuk ka nevojë as për emër përdoruesi, as për fjalëkalim — ai është
--   thjesht një e dhënë: emri dhe lëndët që jep.
--
--   Një llogari hyrjeje që askush nuk e përdor është vetëm rrezik:
--   fjalëkalime të pandryshuara, llogari të harruara dhe një rol më
--   shumë për t'u mbajtur në rregull pa asnjë përfitim.
--
--   Prandaj krijohet tabela `professors` dhe roli 'profesor' hiqet.
--
--   ID-të RUHEN të njëjtat: profesorët e krijuar si përdorues kalojnë
--   te tabela e re me id-në e vet, kështu që orët e shënuara dhe lidhjet
--   me lëndët mbeten të pacenuara, pa asnjë rilidhje.
--
-- Run:  mysql -u root -p ispe_school < database/migrate-029-profesoret-pa-llogari.sql
-- ---------------------------------------------------------------

USE ispe_school;

SET NAMES utf8mb4;
SET SQL_SAFE_UPDATES = 0;

-- 1. Tabela e re
CREATE TABLE IF NOT EXISTS professors (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  full_name  VARCHAR(120) NOT NULL,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB;

CREATE INDEX idx_professor_name ON professors (full_name);

-- 2. Profesorët ekzistues kalojnë me ID-në e vet
INSERT IGNORE INTO professors (id, full_name, is_active)
SELECT id, full_name, is_active FROM users WHERE role = 'profesor';

-- 3. Lidhjet ridrejtohen nga `users` te `professors`
ALTER TABLE professor_subjects DROP FOREIGN KEY fk_ps_professor;
ALTER TABLE professor_subjects
  ADD CONSTRAINT fk_ps_professor FOREIGN KEY (professor_id)
      REFERENCES professors (id) ON DELETE CASCADE;

ALTER TABLE lessons DROP FOREIGN KEY fk_lesson_professor;
ALTER TABLE lessons DROP FOREIGN KEY fk_lesson_missing;
ALTER TABLE lessons
  ADD CONSTRAINT fk_lesson_professor FOREIGN KEY (professor_id)
      REFERENCES professors (id),
  ADD CONSTRAINT fk_lesson_missing FOREIGN KEY (substitute_for)
      REFERENCES professors (id) ON DELETE SET NULL;

-- 4. Llogaritë e profesorëve hiqen; created_by/reviewed_by mbeten te users
--    sepse ata JANË përdorues të vërtetë (stafi që shënoi ose kontrolloi).
DELETE FROM users WHERE role = 'profesor';

-- 5. Roli hiqet nga lista
ALTER TABLE users
  MODIFY role ENUM('admin','menaxher','finance','kujdestar','staff')
  NOT NULL DEFAULT 'staff';

-- Kontroll
SELECT COUNT(*) AS profesore FROM professors;
SELECT COUNT(*) AS ore_te_lidhura FROM lessons;

SET SQL_SAFE_UPDATES = 1;