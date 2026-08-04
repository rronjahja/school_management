-- ---------------------------------------------------------------
-- Migrimi 019: ditari i veprimeve (Logs)
--
--   Ruan ÇDO ndryshim: kush e bëri, çfarë bëri, mbi çfarë, dhe kur.
--
--   PSE JO TRIGGER-A NË BAZË: një trigger e sheh vetëm rreshtin që
--   ndryshoi, jo përdoruesin që e nisi veprimin — të gjitha lidhjet vijnë
--   nga i njëjti përdorues MySQL. Emri i personit, IP-ja dhe rruga e
--   kërkesës i di vetëm aplikacioni, prandaj shkruhen atje.
--
-- Run:  mysql -u root -p ispe_school < database/migrate-019-ditari.sql
-- ---------------------------------------------------------------

USE ispe_school;

SET NAMES utf8mb4;
SET SQL_SAFE_UPDATES = 0;

CREATE TABLE IF NOT EXISTS activity_log (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT          DEFAULT NULL,          -- kush (NULL nese llogaria fshihet)
  username     VARCHAR(60)  NOT NULL,              -- ruhet edhe si tekst: mbetet i lexueshem
  full_name    VARCHAR(120) DEFAULT NULL,
  role         VARCHAR(20)  DEFAULT NULL,          -- roli NE ATE CAST
  action       VARCHAR(40)  NOT NULL,              -- p.sh. student.create
  entity       VARCHAR(30)  NOT NULL,              -- student, payment, user...
  entity_id    VARCHAR(40)  DEFAULT NULL,
  summary      VARCHAR(255) DEFAULT NULL,          -- pershkrim i lexueshem shqip
  details      TEXT         DEFAULT NULL,          -- JSON: fushat qe ndryshuan
  method       VARCHAR(8)   DEFAULT NULL,
  path         VARCHAR(255) DEFAULT NULL,
  status_code  SMALLINT     DEFAULT NULL,
  ip           VARCHAR(60)  DEFAULT NULL,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_log_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE = InnoDB;

-- Kerkimi behet me shpesh sipas kohes, pastaj sipas personit dhe subjektit
CREATE INDEX idx_log_time   ON activity_log (created_at);
CREATE INDEX idx_log_user   ON activity_log (username, created_at);
CREATE INDEX idx_log_entity ON activity_log (entity, entity_id);
CREATE INDEX idx_log_action ON activity_log (action, created_at);

SELECT COUNT(*) AS rreshta_ne_ditar FROM activity_log;

SET SQL_SAFE_UPDATES = 1;