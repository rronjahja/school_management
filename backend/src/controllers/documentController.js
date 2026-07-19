const documentService = require('../services/documentService');

async function listTemplates(req, res, next) {
  try {
    res.json(documentService.listTemplates());
  } catch (err) { next(err); }
}

async function generate(req, res, next) {
  try {
    const { buffer, filename } = await documentService.generateDocument(
      req.params.id,
      req.query.template // opsionale; pa te merret shablloni i pare
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(buffer);
  } catch (err) { next(err); }
}

module.exports = { listTemplates, generate };