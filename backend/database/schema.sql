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
  father_name        VARCHAR(80)  DEFAULT NULL,
  father_last_name   VARCHAR(80)  DEFAULT NULL,
  father_phone       VARCHAR(40)  DEFAULT NULL,
  father_birthday    DATE         DEFAULT NULL,
  father_personal_id VARCHAR(20)  DEFAULT NULL,
  -- Kujdestari ligjor: perdoret NE VEND te prinderve kur nxenesi ka kujdestar
  guardian_name        VARCHAR(80) DEFAULT NULL,
  guardian_last_name   VARCHAR(80) DEFAULT NULL,
  guardian_phone       VARCHAR(40) DEFAULT NULL,
  guardian_birthday    DATE        DEFAULT NULL,
  guardian_personal_id VARCHAR(20) DEFAULT NULL,
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
  role          ENUM('admin','staff') NOT NULL DEFAULT 'staff',
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