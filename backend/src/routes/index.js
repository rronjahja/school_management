const { Router } = require('express');
const express = require('express');

const studentController = require('../controllers/studentController');
const paymentController = require('../controllers/paymentController');
const metaController = require('../controllers/metaController');
const exportController = require('../controllers/exportController');
const importController = require('../controllers/importController');
const dashboardController = require('../controllers/dashboardController');
const documentController = require('../controllers/documentController');
const promotionController = require('../controllers/promotionController');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const { requireAuth, requireAdmin, requireFinance } = require('../middleware/auth');

const router = Router();

// ---------------------------------------------------------------
// Rrugët PUBLIKE (të vetmet pa identifikim)
// ---------------------------------------------------------------
router.post('/auth/login', authController.login);
router.get('/auth/status', authController.status);

// ---------------------------------------------------------------
// Nga këtu e poshtë, ÇDO kërkesë kërkon sesion të vlefshëm
// ---------------------------------------------------------------
router.use(requireAuth);

router.get('/auth/me', authController.me);
router.post('/auth/logout', authController.logout);
router.post('/auth/change-password', authController.changePassword);

// Menaxhimi i përdoruesve — vetëm administratorët
router.get('/users', requireAdmin, userController.list);
router.post('/users', requireAdmin, userController.create);
router.put('/users/:id', requireAdmin, userController.update);
router.post('/users/:id/reset-password', requireAdmin, userController.resetPassword);

// Meta
router.get('/categories', metaController.categories);
router.get('/banks', requireFinance, metaController.banks);

// Konfigurimet — vetëm administratorët mund të ndryshojnë
router.post('/banks', requireAdmin, metaController.createBank);
router.put('/banks/:id', requireAdmin, metaController.updateBank);
router.delete('/banks/:id', requireAdmin, metaController.removeBank);

// Mesazhi i rikujteses: lexohet nga te gjithe (nevojitet per ta derguar),
// ndryshohet vetem nga administratoret
// Fletëpagesa: e nje pagese te caktuar, ose e detyrimeve (rikujtesa)
router.get('/payments/:id/fletepagesa', requireFinance, documentController.paymentSlip);
router.get('/students/:id/fletepagesa', requireFinance, documentController.reminderSlip);

// Migrimi i kontratave (vetem admin): trupi i kerkeses eshte skedari .docx
router.post(
  '/import/contract',
  requireAdmin,
  express.raw({ type: () => true, limit: '10mb' }),
  importController.contract
);
router.post('/import/check-existing', requireAdmin, importController.existing);

// Eksporti ne Excel i pagesave te nje gjenerate (te gjitha drejtimet)
router.get('/export/finance-excel', requireFinance, exportController.financeExcel);

router.get('/settings/reminder-template', requireFinance, metaController.reminderTemplate);
router.put('/settings/reminder-template', requireAdmin, metaController.saveReminderTemplate);

router.post('/categories', requireAdmin, metaController.createCategory);
router.put('/categories/:id', requireAdmin, metaController.updateCategory);
router.delete('/categories/:id', requireAdmin, metaController.removeCategory);

// Paneli
router.get('/dashboard', dashboardController.stats);

// Studentet
router.get('/students/next-contract-number', studentController.nextContractNumber);
router.get('/students', studentController.list);
router.post('/students', studentController.create);
router.get('/students/:id', studentController.detail);
router.put('/students/:id', studentController.update);
router.delete('/students/:id', requireAdmin, studentController.remove);

// Dokumentet Word (shabllonet ne backend/templates)
router.get('/templates', documentController.listTemplates);
router.get('/students/:id/document', documentController.generate);
// rruga e vjeter mbahet per pajtueshmeri
router.get('/students/:id/registration-doc', documentController.generate);

// Promovimi i gjeneratave (kalimi i vitit)
router.get('/promotion', requireAdmin, promotionController.overview);
router.get('/promotion/preview', requireAdmin, promotionController.preview);
router.post('/promotion/run', requireAdmin, promotionController.run);

// Pagesat
router.post('/payments', requireFinance, paymentController.create);
router.delete('/payments/:id', requireAdmin, paymentController.remove);

module.exports = router;