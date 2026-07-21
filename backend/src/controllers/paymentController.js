const paymentService = require('../services/paymentService');
const financeService = require('../services/financeService');

async function create(req, res, next) {
  try {
    const paymentId = await paymentService.createPayment(req.body);
    // Kthejme detajet e freskuara qe UI te perditesohet menjehere;
    // last_payment_id i duhet fletepageses se pageses qe sapo u ruajt
    const detail = await financeService.getStudentDetail(req.body.student_id);
    res.status(201).json({ ...detail, last_payment_id: paymentId });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await paymentService.deletePayment(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = { create, remove };