const paymentService = require('../services/paymentService');
const financeService = require('../services/financeService');

async function create(req, res, next) {
  try {
    await paymentService.createPayment(req.body);
    // Kthejme detajet e freskuara qe UI te perditesohet menjehere
    res.status(201).json(await financeService.getStudentDetail(req.body.student_id));
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await paymentService.deletePayment(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = { create, remove };
