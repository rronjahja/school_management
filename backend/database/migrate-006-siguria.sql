-- ---------------------------------------------------------------
-- Migrimi 006: siguria — perdoruesit dhe hyrja ne sistem
-- Run:  mysql -u root -p ispe_school < database/migrate-006-siguria.sql
-- ---------------------------------------------------------------

USE ispe_school;

SET NAMES utf8mb4;
SET SQL_SAFE_UPDATES = 0;

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(60)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(120) NOT NULL,
  role          ENUM('admin','staff') NOT NULL DEFAULT 'staff',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,

  -- Mbrojtja nga sulmet me fjalekalime te njepasnjeshme
  failed_attempts INT       NOT NULL DEFAULT 0,
  locked_until    DATETIME  DEFAULT NULL,

  last_login_at TIMESTAMP NULL DEFAULT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB;

-- Regjistri i hyrjeve (per auditim)
CREATE TABLE IF NOT EXISTS login_log (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  username   VARCHAR(60) NOT NULL,
  success    TINYINT(1)  NOT NULL,
  ip         VARCHAR(60) DEFAULT NULL,
  user_agent VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB;

CREATE INDEX idx_login_log_time ON login_log (created_at);

SELECT 'Tabelat u krijuan. Tani krijoni administratorin e pare:' AS hapi_tjeter;
SELECT 'cd backend && npm run create-admin' AS komanda;

SET SQL_SAFE_UPDATES = 1;
