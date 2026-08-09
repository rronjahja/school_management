-- ---------------------------------------------------------------
-- Migrimi 030: hiqen kërkesat për ndryshimin e notave
--
--   Politika ndryshoi: kujdestari i ndryshon notat kurdo, edhe ato të
--   mbyllura, dhe stafi mund t'i korrigjojë vetë kur gjen një
--   mospërputhje me librin fizik. Prandaj nuk ka më kërkesa e miratime.
--
--   Shënimi i gabimeve MBETET: stafi e shënon një notë si gabim me
--   koment, shenja duket mbi qelizë në ditar, dhe mbyllet vetvetiu sapo
--   nota korrigjohet. Ajo që bie është vetëm hallka e miratimit.
--
--   Tabela `grade_reviews` NUK preket.
--
-- Run:  mysql -u root -p ispe_school < database/migrate-030-pa-kerkesa-notash.sql
-- ---------------------------------------------------------------

USE ispe_school;

SET NAMES utf8mb4;

DROP TABLE IF EXISTS grade_edit_requests;

SELECT COUNT(*) AS kontrolle_qe_mbeten FROM grade_reviews;