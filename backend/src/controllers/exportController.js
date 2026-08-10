const exportService = require('../services/exportService');

/** GET /export/finance-excel?generation=2025/2026 — shkarkon librin e pagesave */
async function financeExcel(req, res, next) {
  try {
    const generation = req.query.generation;
    const { workbook, filename } = await exportService.buildFinanceWorkbook(generation);

    // Nxjerrja e te gjitha pagesave te nje gjenerate eshte veprim qe lihet
    // gjurme: eshte tabela me e ndjeshme e sistemit.
    res.locals.logSummary = `Eksport Excel i pagesave — gjenerata ${generation}`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
}

module.exports = { financeExcel };