-- ---------------------------------------------------------------
-- ISPE High School Management System - MySQL schema
-- Run:  mysql -u root -p < database/schema.sql
-- ---------------------------------------------------------------

CREATE DATABASE IF NOT EXISTS ispe_school
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ispe_school;

-- E domosdoshme: pa kete, shkronjat shqipe (ë, ç) prishen gjate importimit
SET NAMES utf8mb4;

-- ----------------------------------------------------------------
-- Drejtimet (kategorite e studimit)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  code       VARCHAR(6)   NOT NULL DEFAULT '',    -- perdoret te nr. i kontrates, p.sh. TF
  default_quota DECIMAL(10,2) DEFAULT NULL,        -- kuota vjetore e paracaktuar
  color      VARCHAR(7)   NOT NULL DEFAULT '#2E6FB7',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB;

INSERT INTO categories (name, code, color) VALUES
  ('Teknik Dentar', 'TD', '#6E59C7'),
  ('Farmaci',       'TF', '#1F8A70'),
  ('Fizioterapi',   'AF', '#D07A2F'),
  ('Infermieri',    'AI', '#C24E6A'),   -- konfirmoni kodin
  ('Informatikë',   'TI', '#2E6FB7')    -- konfirmoni kodin
ON DUPLICATE KEY UPDATE code = VALUES(code), color = VALUES(color);

-- ----------------------------------------------------------------
-- Bankat (emrat mund t'i ndryshoni lirisht ketu)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS banks (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(100) NOT NULL UNIQUE,
  account_number VARCHAR(40)  DEFAULT NULL,        -- perdoret te mesazhet e rikujteses
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB;

INSERT INTO banks (name, account_number) VALUES
  ('BKT',             NULL),
  ('Raiffeisen Bank', '1501 1500 0091 7205'),
  ('NLB Banka',       NULL),
  ('TEB Bank',        '2011 0000 2024 7044')
ON DUPLICATE KEY UPDATE account_number = COALESCE(banks.account_number, VALUES(account_number));

-- ----------------------------------------------------------------
-- Studentet
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  first_name      VARCHAR(80)  NOT NULL,
  last_name       VARCHAR(80)  NOT NULL,
  birthday        DATE         NOT NULL,
  gender          ENUM('m','f') DEFAULT NULL,      -- per drejtshkrimin e mesazheve
  city            VARCHAR(80)  NOT NULL,
  address         VARCHAR(160) NOT NULL,
  email           VARCHAR(120) DEFAULT NULL,
  citizenship     VARCHAR(60)  DEFAULT NULL,      -- shtetesia
  nationality     VARCHAR(60)  DEFAULT NULL,      -- kombesia

  -- Te dy prinderit kane te njejtat fusha
  mother_name        VARCHAR(80)  DEFAULT NULL,
  mother_last_name   VARCHAR(80)  DEFAULT NULL,
  mother_phone       VARCHAR(40)  DEFAULT NULL,
  mother_birthday    DATE         DEFAULT NULL,
  mother_personal_id VARCHAR(20)  DEFAULT NULL,
  mother_email       VARCHAR(120) DEFAULT NULL,
  father_name        VARCHAR(80)  DEFAULT NULL,
  father_last_name   VARCHAR(80)  DEFAULT NULL,
  father_phone       VARCHAR(40)  DEFAULT NULL,
  father_birthday    DATE         DEFAULT NULL,
  father_personal_id VARCHAR(20)  DEFAULT NULL,
  father_email       VARCHAR(120) DEFAULT NULL,
  -- Kujdestari ligjor: perdoret NE VEND te prinderve kur nxenesi ka kujdestar
  guardian_name        VARCHAR(80) DEFAULT NULL,
  guardian_last_name   VARCHAR(80) DEFAULT NULL,
  guardian_phone       VARCHAR(40) DEFAULT NULL,
  guardian_birthday    DATE        DEFAULT NULL,
  guardian_personal_id VARCHAR(20) DEFAULT NULL,
  guardian_gender      ENUM('m','f') DEFAULT NULL,
  guardian_email       VARCHAR(120) DEFAULT NULL,
  -- Kush kontaktohet i pari. 'guardian' do te thote qe nxenesi ka kujdestar
  -- ligjor dhe fushat e prinderve nuk perdoren.
  primary_contact ENUM('mother','father','guardian') NOT NULL DEFAULT 'father',
  phone           VARCHAR(30)  DEFAULT NULL,      -- opsional: kontakti kryesor eshte prindi

  category_id     INT NOT NULL,
  contract_number VARCHAR(30)  DEFAULT NULL,        -- p.sh. '22/2025/TF'
  generation      VARCHAR(20)  NOT NULL,            -- p.sh. '2025/2026'
  class_name      VARCHAR(20)  DEFAULT NULL,        -- p.sh. 'X-1'
  study_year      TINYINT      NOT NULL DEFAULT 1,   -- 1 = Viti I, 2 = Viti II, 3 = Viti III
  status          ENUM('active','graduated') NOT NULL DEFAULT 'active',
  graduated_at    DATE         DEFAULT NULL,
  graduation_generation VARCHAR(20) DEFAULT NULL,
  enrollment_date DATE NOT NULL,

  yearly_quota    DECIMAL(10,2) NOT NULL,
  settled_paid    DECIMAL(10,2) NOT NULL DEFAULT 0,  -- pagesa te konsumuara nga keste te hequra (kalimi i vitit)
  discount_type   ENUM('none','percent','amount') NOT NULL DEFAULT 'none',
  discount_value  DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_plan    ENUM('immediate','two','four','six','monthly') NOT NULL DEFAULT 'monthly',

  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_students_category
    FOREIGN KEY (category_id) REFERENCES categories (id)
) ENGINE = InnoDB;

CREATE INDEX idx_students_category ON students (category_id);
CREATE INDEX idx_students_names    ON students (last_name, first_name);
CREATE INDEX idx_students_study_year ON students (study_year);
CREATE INDEX idx_students_status ON students (status);

-- ----------------------------------------------------------------
-- Kestet (gjenerohen automatikisht sipas planit te pageses)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS installments (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  student_id   INT NOT NULL,
  generation   VARCHAR(20) DEFAULT NULL,
  is_carryover TINYINT(1) NOT NULL DEFAULT 0,  -- 1 = rreshti 'Borxhi i vitit te kaluar'          -- viti shkollor i kestit
  seq        INT NOT NULL,
  due_date   DATE NOT NULL,
  amount     DECIMAL(10,2) NOT NULL,

  CONSTRAINT fk_installments_student
    FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
  CONSTRAINT uq_installment UNIQUE (student_id, seq)
) ENGINE = InnoDB;

CREATE INDEX idx_installments_due ON installments (due_date);

-- ----------------------------------------------------------------
-- Pagesat
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  student_id   INT NOT NULL,
  amount       DECIMAL(10,2) NOT NULL,
  payment_date DATE NOT NULL,
  method       ENUM('cash','bank') NOT NULL,
  bank_id      INT DEFAULT NULL,
  note         VARCHAR(255) DEFAULT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_payments_student
    FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_bank
    FOREIGN KEY (bank_id) REFERENCES banks (id)
) ENGINE = InnoDB;

CREATE INDEX idx_payments_student ON payments (student_id);

-- ----------------------------------------------------------------
-- Historiku i viteve te mbyllura (mbushet nga kalimi i vitit)
-- ----------------------------------------------------------------
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

-- ----------------------------------------------------------------
-- Regjistri i kalimeve te vitit (pengon perseritjen aksidentale)
-- ----------------------------------------------------------------
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

-- ----------------------------------------------------------------
-- Perdoruesit e sistemit (hyrja)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(60)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(120) NOT NULL,
  role       ENUM('admin','menaxher','finance','kujdestar','staff','profesor') NOT NULL DEFAULT 'staff',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  failed_attempts INT       NOT NULL DEFAULT 0,
  locked_until    DATETIME  DEFAULT NULL,
  last_login_at TIMESTAMP NULL DEFAULT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS login_log (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  username   VARCHAR(60) NOT NULL,
  success    TINYINT(1)  NOT NULL,
  ip         VARCHAR(60) DEFAULT NULL,
  user_agent VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB;

CREATE INDEX idx_login_log_time ON login_log (created_at);
-- ----------------------------------------------------------------
-- Cilesime te pergjithshme (celes -> vlere), p.sh. teksti i rikujteses
-- ----------------------------------------------------------------
-- ----------------------------------------------------------------
-- Ditari i veprimeve: kush, cfare, mbi cfare, kur
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_log (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT          DEFAULT NULL,
  username     VARCHAR(60)  NOT NULL,
  full_name    VARCHAR(120) DEFAULT NULL,
  role         VARCHAR(20)  DEFAULT NULL,
  action       VARCHAR(40)  NOT NULL,
  entity       VARCHAR(30)  NOT NULL,
  entity_id    VARCHAR(40)  DEFAULT NULL,
  summary      VARCHAR(255) DEFAULT NULL,
  details      TEXT         DEFAULT NULL,
  method       VARCHAR(8)   DEFAULT NULL,
  path         VARCHAR(255) DEFAULT NULL,
  status_code  SMALLINT     DEFAULT NULL,
  ip           VARCHAR(60)  DEFAULT NULL,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_log_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE INDEX idx_log_time   ON activity_log (created_at);
CREATE INDEX idx_log_user   ON activity_log (username, created_at);
CREATE INDEX idx_log_entity ON activity_log (entity, entity_id);
CREATE INDEX idx_log_action ON activity_log (action, created_at);

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(60) PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB;

-- ----------------------------------------------------------------
-- Ditari i klasës (libri «Suksesi i nxënësve sipas lëndëve mësimore»)
-- Paralelet, lëndët, notat, mungesat, sjellja dhe vërejtjet.
-- Kujdestari (users.role = 'kujdestar') caktohet nga administratori.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classes (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(20) NOT NULL,              -- vetem numri: '1' ... '8'
  category_id  INT         NOT NULL,              -- drejtimi
  study_year   TINYINT     NOT NULL DEFAULT 1,    -- 1 = Viti I ... 3 = Viti III
  school_year  VARCHAR(20) NOT NULL,              -- p.sh. '2025/2026'
  kujdestar_id INT         DEFAULT NULL,          -- users.id me rol 'kujdestar'
  is_active    TINYINT(1)  NOT NULL DEFAULT 1,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_classes_category  FOREIGN KEY (category_id)  REFERENCES categories (id),
  CONSTRAINT fk_classes_kujdestar FOREIGN KEY (kujdestar_id) REFERENCES users (id) ON DELETE SET NULL,
  -- Paralelja 1 e Farmacise dhe paralelja 1 e TIK-ut jane dy klasa te ndryshme
  CONSTRAINT uq_class_nr UNIQUE (category_id, study_year, school_year, name)
) ENGINE = InnoDB;

CREATE INDEX idx_classes_kujdestar ON classes (kujdestar_id);

CREATE TABLE IF NOT EXISTS class_subjects (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  class_id   INT         NOT NULL,
  name       VARCHAR(80) NOT NULL,
  grp        ENUM('gjuhet','matematika','shkencat','shoqeria','sportet',
                  'teknologjia','teorike','praktike') NOT NULL DEFAULT 'teorike',
  position   SMALLINT    NOT NULL DEFAULT 0,
  is_active  TINYINT(1)  NOT NULL DEFAULT 1,      -- 0 = e hequr, por notat ruhen
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_subjects_class FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE INDEX idx_subjects_class ON class_subjects (class_id, grp, position);

-- Notat e vazhdueshme — shifrat blu në rreshtat I dhe II të librit
CREATE TABLE IF NOT EXISTS class_grades (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  class_id   INT     NOT NULL,
  student_id INT     NOT NULL,
  subject_id INT     NOT NULL,
  term       ENUM('gj1','gj2') NOT NULL,          -- Gjysmëvjetori I / II
  value      TINYINT NOT NULL,                    -- 1..5
  graded_by  INT     DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_grades_class   FOREIGN KEY (class_id)   REFERENCES classes (id)        ON DELETE CASCADE,
  CONSTRAINT fk_grades_student FOREIGN KEY (student_id) REFERENCES students (id)       ON DELETE CASCADE,
  CONSTRAINT fk_grades_subject FOREIGN KEY (subject_id) REFERENCES class_subjects (id) ON DELETE CASCADE,
  CONSTRAINT fk_grades_user    FOREIGN KEY (graded_by)  REFERENCES users (id)          ON DELETE SET NULL,
  CONSTRAINT chk_grade_value CHECK (value BETWEEN 1 AND 5)
) ENGINE = InnoDB;

CREATE INDEX idx_grades_cell  ON class_grades (student_id, subject_id, term);
CREATE INDEX idx_grades_class ON class_grades (class_id);

-- Mbyllja e notave — shifra e kuqe.
--   term = 'gj1'   → mbyllja e Gjysmëvjetorit I  (brenda rreshtit I)
--   term = 'gj2'   → mbyllja e Gjysmëvjetorit II (brenda rreshtit II)
--   term = 'final' → nota përfundimtare          (rreshti N.P.)
CREATE TABLE IF NOT EXISTS class_final_grades (
  id         INT     AUTO_INCREMENT PRIMARY KEY,
  class_id   INT     NOT NULL,
  student_id INT     NOT NULL,
  subject_id INT     NOT NULL,
  term       ENUM('gj1','gj2','final') NOT NULL DEFAULT 'final',
  value      TINYINT NOT NULL,
  decided_by INT     DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_final_class   FOREIGN KEY (class_id)   REFERENCES classes (id)        ON DELETE CASCADE,
  CONSTRAINT fk_final_student FOREIGN KEY (student_id) REFERENCES students (id)       ON DELETE CASCADE,
  CONSTRAINT fk_final_subject FOREIGN KEY (subject_id) REFERENCES class_subjects (id) ON DELETE CASCADE,
  CONSTRAINT fk_final_user    FOREIGN KEY (decided_by) REFERENCES users (id)          ON DELETE SET NULL,
  CONSTRAINT uq_final_term UNIQUE (subject_id, student_id, term),
  CONSTRAINT chk_final_value CHECK (value BETWEEN 1 AND 5)
) ENGINE = InnoDB;

-- Mungesat, nota e sjelljes dhe vërejtja — një rresht për (paralele, nxënës)
CREATE TABLE IF NOT EXISTS class_student_meta (
  id                INT      AUTO_INCREMENT PRIMARY KEY,
  class_id          INT      NOT NULL,
  student_id        INT      NOT NULL,
  position          SMALLINT DEFAULT NULL,       -- rendi ne ditar; NULL = fund, sipas alfabetit
  absent_just_gj1   SMALLINT NOT NULL DEFAULT 0,  -- të arsyeshme, Gjysmëvjetori I
  absent_unjust_gj1 SMALLINT NOT NULL DEFAULT 0,  -- të paarsyeshme
  absent_just_gj2   SMALLINT NOT NULL DEFAULT 0,
  absent_unjust_gj2 SMALLINT NOT NULL DEFAULT 0,
  conduct_gj1       TINYINT  DEFAULT NULL,        -- nota e sjelljes 1..5
  conduct_gj2       TINYINT  DEFAULT NULL,
  conduct_final     TINYINT  DEFAULT NULL,
  remark            VARCHAR(500) DEFAULT NULL,    -- vërejtje
  updated_by        INT      DEFAULT NULL,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_meta_class   FOREIGN KEY (class_id)   REFERENCES classes (id)  ON DELETE CASCADE,
  CONSTRAINT fk_meta_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
  CONSTRAINT fk_meta_user    FOREIGN KEY (updated_by) REFERENCES users (id)    ON DELETE SET NULL,
  CONSTRAINT uq_meta UNIQUE (class_id, student_id)
) ENGINE = InnoDB;

CREATE INDEX idx_meta_position ON class_student_meta (class_id, position);

-- ----------------------------------------------------------------
-- Kerkesat per ndryshimin e notes se mbyllur.
-- Kujdestari nuk e prek nje note te mbyllur: kerkon leje nga
-- administratori. Leja vlen per NJE ndryshim ('used' pas perdorimit).
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grade_edit_requests (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  class_id      INT NOT NULL,
  student_id    INT NOT NULL,
  subject_id    INT NOT NULL,
  term          ENUM('gj1','gj2','final') NOT NULL,
  old_value     TINYINT DEFAULT NULL,
  reason        VARCHAR(500) NOT NULL,
  status        ENUM('pending','approved','declined','used') NOT NULL DEFAULT 'pending',
  requested_by  INT NOT NULL,
  decided_by    INT DEFAULT NULL,
  decision_note VARCHAR(500) DEFAULT NULL,
  decided_at    DATETIME DEFAULT NULL,
  used_at       DATETIME DEFAULT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_req_class     FOREIGN KEY (class_id)     REFERENCES classes (id)        ON DELETE CASCADE,
  CONSTRAINT fk_req_student   FOREIGN KEY (student_id)   REFERENCES students (id)       ON DELETE CASCADE,
  CONSTRAINT fk_req_subject   FOREIGN KEY (subject_id)   REFERENCES class_subjects (id) ON DELETE CASCADE,
  CONSTRAINT fk_req_requester FOREIGN KEY (requested_by) REFERENCES users (id),
  CONSTRAINT fk_req_decider   FOREIGN KEY (decided_by)   REFERENCES users (id)          ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE INDEX idx_req_status ON grade_edit_requests (status, created_at);
CREATE INDEX idx_req_cell   ON grade_edit_requests (class_id, student_id, subject_id, term, status);

-- ----------------------------------------------------------------
-- Kontrolli i notave: stafi krahason ditarin elektronik me librin
-- fizik dhe per cdo note ose e pranon, ose shenon gabim me koment.
-- Korrigjimin e ben kujdestari; gabimi mbyllet vetvetiu kur nota
-- e shenuar ndryshon.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grade_reviews (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  class_id       INT NOT NULL,
  student_id     INT NOT NULL,
  subject_id     INT NOT NULL,
  kind           ENUM('mark','closing') NOT NULL,
  term           ENUM('gj1','gj2','final') NOT NULL,
  grade_id       INT DEFAULT NULL,
  observed_value TINYINT NOT NULL,
  status         ENUM('ok','error','resolved','dismissed') NOT NULL DEFAULT 'ok',
  comment        VARCHAR(500) DEFAULT NULL,
  reviewed_by    INT NOT NULL,
  reviewed_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_by    INT DEFAULT NULL,
  resolved_at    DATETIME DEFAULT NULL,

  CONSTRAINT fk_rev_class    FOREIGN KEY (class_id)    REFERENCES classes (id)        ON DELETE CASCADE,
  CONSTRAINT fk_rev_student  FOREIGN KEY (student_id)  REFERENCES students (id)       ON DELETE CASCADE,
  CONSTRAINT fk_rev_subject  FOREIGN KEY (subject_id)  REFERENCES class_subjects (id) ON DELETE CASCADE,
  CONSTRAINT fk_rev_grade    FOREIGN KEY (grade_id)    REFERENCES class_grades (id)   ON DELETE SET NULL,
  CONSTRAINT fk_rev_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (id),
  CONSTRAINT fk_rev_resolver FOREIGN KEY (resolved_by) REFERENCES users (id)          ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE INDEX idx_rev_status ON grade_reviews (status, reviewed_at);
CREATE INDEX idx_rev_cell   ON grade_reviews (class_id, student_id, subject_id, term, kind);

-- ----------------------------------------------------------------
-- Ditari i oreve te mesimit: deri ne 7 ore ne dite; profesori shenon
-- lenden dhe temen. Ora i numerohet atij qe e MBAJTI (professor_id);
-- kush mungoi ruhet te substitute_for. Stafi e kontrollon cdo ore.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lessons (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  class_id       INT  NOT NULL,
  lesson_date    DATE NOT NULL,
  period         TINYINT NOT NULL,
  subject_id     INT  NOT NULL,
  professor_id   INT  NOT NULL,
  substitute_for INT  DEFAULT NULL,
  topic          VARCHAR(500) NOT NULL,
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
  CONSTRAINT uq_lesson UNIQUE (class_id, lesson_date, period),
  CONSTRAINT chk_period CHECK (period BETWEEN 1 AND 7)
) ENGINE = InnoDB;

CREATE INDEX idx_lesson_month ON lessons (class_id, lesson_date);
CREATE INDEX idx_lesson_prof  ON lessons (professor_id, lesson_date);