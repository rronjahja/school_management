const { Router } = require('express');

const studentController = require('../controllers/studentController');
const paymentController = require('../controllers/paymentController');
const metaController = require('../controllers/metaController');
const dashboardController = require('../controllers/dashboardController');
const documentController = require('../controllers/documentController');
const promotionController = require('../controllers/promotionController');

const router = Router();

// Meta
router.get('/categories', metaController.categories);
router.get('/banks', metaController.banks);

// Paneli
router.get('/dashboard', dashboardController.stats);

// Studentet
router.get('/students/next-contract-number', studentController.nextContractNumber);
router.get('/students', studentController.list);
router.post('/students', studentController.create);
router.get('/students/:id', studentController.detail);
router.put('/students/:id', studentController.update);
router.delete('/students/:id', studentController.remove);

// Dokumentet Word (shabllonet ne backend/templates)
router.get('/templates', documentController.listTemplates);
router.get('/students/:id/document', documentController.generate);
// rruga e vjeter mbahet per pajtueshmeri
router.get('/students/:id/registration-doc', documentController.generate);

// Promovimi i gjeneratave (kalimi i vitit)
router.get('/promotion', promotionController.overview);
router.get('/promotion/preview', promotionController.preview);
router.post('/promotion/run', promotionController.run);

// Pagesat
router.post('/payments', paymentController.create);
router.delete('/payments/:id', paymentController.remove);

module.exports = router;