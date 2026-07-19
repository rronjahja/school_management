import client from './client';

export const fetchPromotionOverview = () =>
  client.get('/promotion').then((r) => r.data);

export const fetchPromotionPreview = (from_generation) =>
  client.get('/promotion/preview', { params: { from_generation } }).then((r) => r.data);

export const runPromotion = (data) =>
  client.post('/promotion/run', data).then((r) => r.data);