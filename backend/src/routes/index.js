const { Router } = require('express');

const studentController = require('../controllers/studentController');
const paymentController = require('../controllers/paymentController');
const metaController = require('../controllers/metaController');
const dashboardController = require('../controllers/dashboardController');
const documentController = require('../controllers/documentController');

const router = Router();

// Meta
router.get('/categories', metaController.categories);
router.get('/banks', metaController.banks);

// Paneli
router.get('/dashboard', dashboardController.stats);

// Studentet
router.get('/students', studentController.list);
router.post('/students', studentController.create);
router.get('/students/:id', studentController.detail);
router.put('/students/:id', studentController.update);
router.delete('/students/:id', studentController.remove);

// Dokumenti Word i regjistrimit
router.get('/students/:id/registration-doc', documentController.registrationDoc);

// Pagesat
router.post('/payments', paymentController.create);
router.delete('/payments/:id', paymentController.remove);

module.exports = router;
