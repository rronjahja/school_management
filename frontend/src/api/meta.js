import client from './client';

export const fetchCategories = () =>
  client.get('/categories').then((r) => r.data);

export const fetchBanks = () =>
  client.get('/banks').then((r) => r.data);
