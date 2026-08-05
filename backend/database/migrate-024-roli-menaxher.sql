-- ---------------------------------------------------------------
-- Migrimi 024: roli 'menaxher'
--
--   Menaxheri bën gjithçka që bën administratori — nxënësit, financat,
--   ditarin, miratimin e kërkesave për nota — PËRVEÇ konfigurimit të
--   sistemit: përdoruesit, drejtimet, bankat, paralelet, kalimi i vitit
--   dhe ditari i veprimeve mbeten vetëm te administratori.
--
--   Kështu shkolla mund të ketë dikë që e drejton punën e përditshme pa
--   pasur në dorë çelësat e konfigurimit.
--
-- Run:  mysql -u root -p ispe_school < database/migrate-024-roli-menaxher.sql
-- ---------------------------------------------------------------

USE ispe_school;

SET NAMES utf8mb4;

ALTER TABLE users
  MODIFY role ENUM('admin','menaxher','finance','kujdestar','staff')
  NOT NULL DEFAULT 'staff';

SELECT role, COUNT(*) AS sa_perdorues FROM users GROUP BY role;