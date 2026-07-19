-- ---------------------------------------------------------------
-- Migrimi 005: promovimi i gjeneratave (kalimi i vitit) + diplomimi
-- Run:  mysql -u root -p ispe_school < database/migrate-005-promovimi.sql
-- ---------------------------------------------------------------

USE ispe_school;

SET NAMES utf8mb4;
SET SQL_SAFE_UPDATES = 0;

-- 1. Statusi i studentit
ALTER TABLE students
  ADD COLUMN status ENUM('active','graduated') NOT NULL DEFAULT 'active' AFTER study_year,
  ADD COLUMN graduated_at DATE DEFAULT NULL AFTER status,
  ADD COLUMN graduation_generation VARCHAR(20) DEFAULT NULL AFTER graduated_at;

CREATE INDEX idx_students_status ON students (status);

-- 2. Cilit vit shkollor i takon secili kest
ALTER TABLE installments
  ADD COLUMN generation VARCHAR(20) DEFAULT NULL AFTER student_id;

UPDATE installments i
  JOIN students s ON s.id = i.student_id
   SET i.generation = s.generation
 WHERE i.generation IS NULL;

CREATE INDEX idx_installments_generation ON installments (generation);

-- 3. Historiku i viteve te mbyllura (per cdo student, cdo vit shkollor)
CREATE TABLE IF NOT EXISTS student_year_history (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  student_id      INT NOT NULL,
  generation      VARCHAR(20) NOT NULL,
  study_year      TINYINT NOT NULL,
  contract_number VARCHAR(30) DEFAULT NULL,
  yearly_quota    DECIMAL(10,2) NOT NULL,
  discount_type   ENUM('none','percent','amount') NOT NULL DEFAULT 'none',
  discount_value  DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_plan    VARCHAR(20) NOT NULL,
  enrollment_date DATE NOT NULL,
  closed_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_history_student
    FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
  CONSTRAINT uq_history UNIQUE (student_id, generation)
) ENGINE = InnoDB;

-- 4. Regjistri i promovimeve (qe te mos ekzekutohet dy here per te njejtin vit)
CREATE TABLE IF NOT EXISTS promotions (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  from_generation  VARCHAR(20) NOT NULL,
  to_generation    VARCHAR(20) NOT NULL,
  promoted_count   INT NOT NULL DEFAULT 0,
  graduated_count  INT NOT NULL DEFAULT 0,
  new_year_created TINYINT(1) NOT NULL DEFAULT 0,
  quota_increase   DECIMAL(5,2) NOT NULL DEFAULT 0,
  note             VARCHAR(255) DEFAULT NULL,
  run_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_promotion UNIQUE (from_generation, to_generation)
) ENGINE = InnoDB;

SELECT status, COUNT(*) AS studente FROM students GROUP BY status;

SET SQL_SAFE_UPDATES = 1;
