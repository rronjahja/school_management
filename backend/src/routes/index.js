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
const activityLogController = require('../controllers/activityLogController');
const registerController = require('../controllers/registerController');
const lessonController = require('../controllers/lessonController');
const professorController = require('../controllers/professorController');
const {
  requireAuth, requireArea, requireAdmin, requireManager, requireFinance, requireKujdestar,
} = require('../middleware/auth');
const { activityLogger } = require('../middleware/activityLogger');

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

// Ditari: kap cdo kerkese qe ndryshon te dhena (POST/PUT/PATCH/DELETE).
// Vendoset ketu, jo ne cdo kontroller, qe asnje veprim te mos harrohet.
router.use(activityLogger);

router.get('/auth/me', authController.me);
router.post('/auth/logout', authController.logout);
router.post('/auth/change-password', authController.changePassword);

// Ditari i veprimeve — vetëm administratorët
router.get('/logs', requireArea('logs'), activityLogController.list);
router.get('/logs/facets', requireArea('logs'), activityLogController.facets);

// Menaxhimi i përdoruesve — vetëm administratorët
router.get('/users', requireAdmin, userController.list);
router.post('/users', requireAdmin, userController.create);
router.put('/users/:id', requireAdmin, userController.update);
router.post('/users/:id/reset-password', requireAdmin, userController.resetPassword);

// Meta
router.get('/categories', metaController.categories);   // lista e drejtimeve i duhet cdo zone
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
router.get('/dashboard', requireArea('dashboard'), dashboardController.stats);

// Studentet
router.get('/students/next-contract-number', requireArea('register'), studentController.nextContractNumber);
router.get('/students', requireArea('students'), studentController.list);
router.post('/students', requireArea('register'), studentController.create);
router.get('/students/:id', requireArea('students'), studentController.detail);
router.put('/students/:id', requireArea('students'), studentController.update);
router.delete('/students/:id', requireManager, studentController.remove);

// Dokumentet Word (shabllonet ne backend/templates)
router.get('/templates', requireArea('students'), documentController.listTemplates);
router.get('/students/:id/document', requireArea('students'), documentController.generate);
// rruga e vjeter mbahet per pajtueshmeri
router.get('/students/:id/registration-doc', requireArea('students'), documentController.generate);

// Promovimi i gjeneratave (kalimi i vitit)
router.get('/promotion', requireAdmin, promotionController.overview);
router.get('/promotion/preview', requireAdmin, promotionController.preview);
router.post('/promotion/run', requireAdmin, promotionController.run);

// ---------------------------------------------------------------
// Ditari i klasës («Suksesi i nxënësve sipas lëndëve mësimore»)
//
// Krijimi/ndryshimi i paraleleve: vetëm administratori.
// Plotësimi i ditarit: administratori dhe kujdestari — por kujdestari
// vetëm për paralelen e vet (verifikohet te registerService).
// ---------------------------------------------------------------
router.get('/classes', requireKujdestar, registerController.listClasses);
router.get('/classes/options', requireArea('administrata'), registerController.classOptions);
router.post('/classes', requireArea('administrata'), registerController.createClass);
router.put('/classes/:id', requireArea('administrata'), registerController.updateClass);
router.delete('/classes/:id', requireArea('administrata'), registerController.removeClass);

router.get('/classes/:id/register', requireKujdestar, registerController.getRegister);

router.post('/classes/:id/subjects', requireKujdestar, registerController.addSubject);
router.put('/subjects/:id', requireKujdestar, registerController.updateSubject);
router.delete('/subjects/:id', requireKujdestar, registerController.removeSubject);

router.post('/classes/:id/grades', requireKujdestar, registerController.addGrade);
router.delete('/grades/:id', requireKujdestar, registerController.removeGrade);
router.put('/classes/:id/final-grade', requireKujdestar, registerController.setFinalGrade);
router.put('/classes/:id/meta/:studentId', requireKujdestar, registerController.saveMeta);
router.put('/classes/:id/order', requireKujdestar, registerController.saveOrder);

// Profesoret dhe lendet qe japin — i menaxhon stafi nga «Administrata».
// Roli 'profesor' shkruhet ne server dhe nuk merret kurre nga kerkesa.
router.get('/subjects', requireArea('administrata'), professorController.listSubjects);
router.post('/subjects', requireArea('administrata'), professorController.createSubject);
router.get('/professors', requireArea('administrata'), professorController.list);
router.post('/professors', requireArea('administrata'), professorController.create);
router.put('/professors/:id', requireArea('administrata'), professorController.update);
router.delete('/professors/:id', requireArea('administrata'), professorController.remove);

// Ditari i oreve te mesimit. Roli 'profesor' hyn VETEM ketu.
// Rregullat e holla (kush shkruan cilen ore) jane te lessonService.
router.get('/lesson-classes', requireArea('mesimi'), lessonController.listClasses);
// Pasqyra e oreve te mbajtura — administrata, jo kujdestari.
router.get('/lessons/held', requireArea('oret_raport'), lessonController.heldLessons);
router.get('/lessons/filters', requireArea('oret_raport'), lessonController.reportFilters);
router.get('/lessons/report', requireArea('oret_raport'), lessonController.monthlyReport);
router.get('/classes/:id/lessons', requireArea('mesimi'), lessonController.getMonth);
router.post('/classes/:id/lessons', requireArea('mesimi'), lessonController.createLesson);
router.put('/lessons/:id', requireArea('mesimi'), lessonController.updateLesson);
router.delete('/lessons/:id', requireArea('mesimi'), lessonController.deleteLesson);
router.put('/lessons/:id/review', requireArea('review'), lessonController.reviewLesson);

// Kontrolli i notave: stafi i pranon ose i shenon si gabim.
// Korrigjimin e ben kush ta gjeje i pari — nuk ka me kerkesa e miratime.
router.post('/classes/:id/reviews', requireArea('review'), registerController.reviewGrade);


// Pagesat
router.post('/payments', requireFinance, paymentController.create);
router.delete('/payments/:id', requireManager, paymentController.remove);

module.exports = router;