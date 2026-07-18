import client from './client';

export const createPayment = (data) =>
  client.post('/payments', data).then((r) => r.data);

export const deletePayment = (id) =>
  client.delete(`/payments/${id}`).then((r) => r.data);
