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