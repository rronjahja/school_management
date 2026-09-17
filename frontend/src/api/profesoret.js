import client from './client';

// ---- Profesorët dhe lëndët ----

export const fetchSubjects = () => client.get('/subjects').then((r) => r.data);

export const createSubject = (data) => client.post('/subjects', data).then((r) => r.data);

export const deleteSubject = (id) =>
  client.delete(`/catalog/subjects/${id}`).then((r) => r.data);

export const setSubjectCategories = (id, category_ids) =>
  client.put(`/catalog/subjects/${id}/categories`, { category_ids }).then((r) => r.data);

export const fetchProfessors = () => client.get('/professors').then((r) => r.data);

export const createProfessor = (data) => client.post('/professors', data).then((r) => r.data);

export const updateProfessor = (id, data) =>
  client.put(`/professors/${id}`, data).then((r) => r.data);

export const deleteProfessor = (id) =>
  client.delete(`/professors/${id}`).then((r) => r.data);