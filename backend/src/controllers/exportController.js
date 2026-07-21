const exportService = require('../services/exportService');

/** GET /export/finance-excel?generation=2025/2026 — shkarkon librin e pagesave */
async function financeExcel(req, res, next) {
  try {
    const { workbook, filename } = await exportService.buildFinanceWorkbook(req.query.generation);
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