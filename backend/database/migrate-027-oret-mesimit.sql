-- ---------------------------------------------------------------
-- Migrimi 027: roli 'profesor' + Ditari i orëve të mësimit
--
--   Digjitalizon librin «Orët e mësimit sipas fushave dhe lëndëve
--   mësimore»: çdo ditë pune ka deri në 7 orë; profesori shënon lëndën
--   dhe temën e orës që mbajti dhe «firmos» me llogarinë e vet.
--
--   Roli 'profesor' shkruan VETËM në këtë ditar — asgjë tjetër.
--
--   Zëvendësimi: kur profesori i paraparë mungon, ora mbahet nga një
--   tjetër. Ora i numërohet atij që e MBAJTI (professor_id); kush mungoi
--   ruhet te substitute_for, që raporti mujor të dalë i drejtë.
--
--   Kontrolli: stafi e krahason çdo orë me librin fizik dhe ose e
--   pranon ('ok'), ose e shënon gabim me koment ('error'). Kur ora
--   ndryshohet, kontrolli kthehet në 'none' — duhet parë sërish.
--
-- Run:  mysql -u root -p ispe_school < database/migrate-027-oret-mesimit.sql
-- ---------------------------------------------------------------

USE ispe_school;

SET NAMES utf8mb4;
SET SQL_SAFE_UPDATES = 0;

ALTER TABLE users
  MODIFY role ENUM('admin','menaxher','finance','kujdestar','staff','profesor')
  NOT NULL DEFAULT 'staff';

CREATE TABLE IF NOT EXISTS lessons (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  class_id       INT  NOT NULL,
  lesson_date    DATE NOT NULL,
  period         TINYINT NOT NULL,                -- ora 1..7 e ditës
  subject_id     INT  NOT NULL,
  professor_id   INT  NOT NULL,                   -- kush e MBAJTI orën
  substitute_for INT  DEFAULT NULL,               -- kush mungoi (nëse zëvendësim)
  topic          VARCHAR(500) NOT NULL,           -- njësia mësimore
  review_status  ENUM('none','ok','error') NOT NULL DEFAULT 'none',
  review_comment VARCHAR(500) DEFAULT NULL,
  reviewed_by    INT DEFAULT NULL,
  reviewed_at    DATETIME DEFAULT NULL,
  created_by     INT DEFAULT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_lesson_class     FOREIGN KEY (class_id)       REFERENCES classes (id)        ON DELETE CASCADE,
  CONSTRAINT fk_lesson_subject   FOREIGN KEY (subject_id)     REFERENCES class_subjects (id) ON DELETE CASCADE,
  CONSTRAINT fk_lesson_professor FOREIGN KEY (professor_id)   REFERENCES users (id),
  CONSTRAINT fk_lesson_missing   FOREIGN KEY (substitute_for) REFERENCES users (id)          ON DELETE SET NULL,
  CONSTRAINT fk_lesson_reviewer  FOREIGN KEY (reviewed_by)    REFERENCES users (id)          ON DELETE SET NULL,
  CONSTRAINT fk_lesson_creator   FOREIGN KEY (created_by)     REFERENCES users (id)          ON DELETE SET NULL,

  -- Një orë e ditës mbahet një herë: dita + ora janë qeliza e librit
  CONSTRAINT uq_lesson UNIQUE (class_id, lesson_date, period),
  CONSTRAINT chk_period CHECK (period BETWEEN 1 AND 7)
) ENGINE = InnoDB;

-- Rrjeta mujore e një paraleleje
CREATE INDEX idx_lesson_month ON lessons (class_id, lesson_date);
-- Raporti mujor sipas profesorit
CREATE INDEX idx_lesson_prof  ON lessons (professor_id, lesson_date);

SELECT COUNT(*) AS ore_ekzistuese FROM lessons;

SET SQL_SAFE_UPDATES = 1;