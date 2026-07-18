const documentService = require('../services/documentService');

async function registrationDoc(req, res, next) {
  try {
    const { buffer, filename } = await documentService.generateRegistrationDoc(req.params.id);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`
    );
    res.send(buffer);
  } catch (err) { next(err); }
}

module.exports = { registrationDoc };
