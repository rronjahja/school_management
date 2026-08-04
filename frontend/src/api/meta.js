import client from './client';

export const fetchCategories = () =>
  client.get('/categories').then((r) => r.data);

export const fetchBanks = () =>
  client.get('/banks').then((r) => r.data);

// ---- Konfigurimet (vetëm admin) ----

export const createBank = (data) => client.post('/banks', data).then((r) => r.data);
export const updateBank = (id, data) => client.put(`/banks/${id}`, data).then((r) => r.data);
export const deleteBank = (id) => client.delete(`/banks/${id}`).then((r) => r.data);

export const createCategory = (data) => client.post('/categories', data).then((r) => r.data);
export const updateCategory = (id, data) =>
  client.put(`/categories/${id}`, data).then((r) => r.data);
export const deleteCategory = (id) => client.delete(`/categories/${id}`).then((r) => r.data);

// ---- Mesazhi i rikujtesës ----

export const fetchReminderTemplate = () =>
  client.get('/settings/reminder-template').then((r) => r.data);

export const saveReminderTemplate = (template) =>
  client.put('/settings/reminder-template', { template }).then((r) => r.data);
// ---- Eksporti në Excel ----

export const downloadFinanceExcel = (generation) =>
  client
    .get('/export/finance-excel', { params: { generation }, responseType: 'blob' })
    .then((r) => {
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ISPE_Pagesat_${generation.replace('/', '-')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });

// ---- Migrimi i kontratave ----

export const parseContractFile = (file) =>
  client
    .post('/import/contract', file, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Filename': encodeURIComponent(file.name),
      },
    })
    .then((r) => r.data);

export const checkExistingContracts = (numbers) =>
  client.post('/import/check-existing', { numbers }).then((r) => r.data);
// ---- Ditari i veprimeve (vetëm administratorët) ----

export const fetchLogs = (params) =>
  client.get('/logs', { params }).then((r) => r.data);

export const fetchLogFacets = () =>
  client.get('/logs/facets').then((r) => r.data);