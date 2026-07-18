-- ---------------------------------------------------------------
-- ISPE High School Management System - MySQL schema
-- Run:  mysql -u root -p < database/schema.sql
-- ---------------------------------------------------------------

CREATE DATABASE IF NOT EXISTS ispe_school
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ispe_school;

-- ----------------------------------------------------------------
-- Drejtimet (kategorite e studimit)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  color      VARCHAR(7)   NOT NULL DEFAULT '#2E6FB7',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB;

INSERT INTO categories (name, color) VALUES
  ('Teknik Dentar', '#6E59C7'),
  ('Farmaci',       '#1F8A70'),
  ('Fizioterapi',   '#D07A2F'),
  ('Infermieri',    '#C24E6A'),
  ('Informatikë',   '#2E6FB7')
ON DUPLICATE KEY UPDATE color = VALUES(color);

-- ----------------------------------------------------------------
-- Bankat (emrat mund t'i ndryshoni lirisht ketu)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS banks (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB;

INSERT INTO banks (name) VALUES
  ('BKT'),
  ('Raiffeisen Bank'),
  ('NLB Banka'),
  ('TEB Bank')
ON DUPLICATE KEY UPDATE name = VALUES(name);

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
  mother_name     VARCHAR(80)  NOT NULL,
  father_name     VARCHAR(80)  NOT NULL,
  phone           VARCHAR(30)  NOT NULL,

  category_id     INT NOT NULL,
  generation      VARCHAR(20)  NOT NULL,            -- p.sh. '2025/2026'
  class_name      VARCHAR(20)  DEFAULT NULL,        -- p.sh. 'X-1'
  enrollment_date DATE NOT NULL,

  yearly_quota    DECIMAL(10,2) NOT NULL,
  discount_type   ENUM('none','percent','amount') NOT NULL DEFAULT 'none',
  discount_value  DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_plan    ENUM('monthly','semiannual','annual') NOT NULL DEFAULT 'monthly',

  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_students_category
    FOREIGN KEY (category_id) REFERENCES categories (id)
) ENGINE = InnoDB;

CREATE INDEX idx_students_category ON students (category_id);
CREATE INDEX idx_students_names    ON students (last_name, first_name);

-- ----------------------------------------------------------------
-- Kestet (gjenerohen automatikisht sipas planit te pageses)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS installments (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
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
