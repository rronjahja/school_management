-- ---------------------------------------------------------------
-- Migrimi 025: kontrolli i notave (pranim / gabim me koment)
--
--   Ditari elektronik duhet të përputhet me librin fizik. Stafi e bën
--   këtë krahasim: kalon nëpër notat e një paraleleje dhe për secilën
--   ose e PRANON (përputhet), ose shënon GABIM me koment — p.sh. «në
--   libër është 3, jo 4».
--
--   Stafi nuk i ndryshon vetë notat: ai vetëm i shënon gabimet.
--   Korrigjimin e bën kujdestari i paraleles, dhe nëse nota është e
--   mbyllur, vetëm pasi t'i miratohet kërkesa.
--
--   Kur nota e shënuar korrigjohet, gabimi mbyllet vetvetiu.
--
--   kind = 'mark'    → një notë e vazhdueshme (class_grades.id)
--   kind = 'closing' → një mbyllje (gj1/gj2/final)
--
-- Run:  mysql -u root -p ispe_school < database/migrate-025-kontrolli-notave.sql
-- ---------------------------------------------------------------

USE ispe_school;

SET NAMES utf8mb4;
SET SQL_SAFE_UPDATES = 0;

CREATE TABLE IF NOT EXISTS grade_reviews (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  class_id       INT NOT NULL,
  student_id     INT NOT NULL,
  subject_id     INT NOT NULL,
  kind           ENUM('mark','closing') NOT NULL,
  term           ENUM('gj1','gj2','final') NOT NULL,
  grade_id       INT DEFAULT NULL,           -- class_grades.id kur kind='mark'
  observed_value TINYINT NOT NULL,           -- nota që figuronte kur u kontrollua
  status         ENUM('ok','error','resolved','dismissed') NOT NULL DEFAULT 'ok',
  comment        VARCHAR(500) DEFAULT NULL,  -- i detyrueshëm kur status='error'
  reviewed_by    INT NOT NULL,
  reviewed_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_by    INT DEFAULT NULL,
  resolved_at    DATETIME DEFAULT NULL,

  CONSTRAINT fk_rev_class    FOREIGN KEY (class_id)    REFERENCES classes (id)        ON DELETE CASCADE,
  CONSTRAINT fk_rev_student  FOREIGN KEY (student_id)  REFERENCES students (id)       ON DELETE CASCADE,
  CONSTRAINT fk_rev_subject  FOREIGN KEY (subject_id)  REFERENCES class_subjects (id) ON DELETE CASCADE,
  -- Nota e vazhdueshme mund të fshihet gjatë korrigjimit; gabimi mbetet
  -- si dëshmi, thjesht pa lidhje me rreshtin e fshirë.
  CONSTRAINT fk_rev_grade    FOREIGN KEY (grade_id)    REFERENCES class_grades (id)   ON DELETE SET NULL,
  CONSTRAINT fk_rev_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (id),
  CONSTRAINT fk_rev_resolver FOREIGN KEY (resolved_by) REFERENCES users (id)          ON DELETE SET NULL
) ENGINE = InnoDB;

-- Lista e gabimeve hapet gjithnjë te ato të hapurat
CREATE INDEX idx_rev_status ON grade_reviews (status, reviewed_at);
-- Ditari pyet për gjendjen e çdo qelize sa herë hapet
CREATE INDEX idx_rev_cell   ON grade_reviews (class_id, student_id, subject_id, term, kind);

SELECT status, COUNT(*) AS sa FROM grade_reviews GROUP BY status;

SET SQL_SAFE_UPDATES = 1;