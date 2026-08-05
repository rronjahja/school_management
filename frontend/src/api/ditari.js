import client from './client';

// ---- Paralelet ----

export const fetchClasses = () => client.get('/classes').then((r) => r.data);

export const fetchClassOptions = () => client.get('/classes/options').then((r) => r.data);

export const createClass = (data) => client.post('/classes', data).then((r) => r.data);

export const updateClass = (id, data) => client.put(`/classes/${id}`, data).then((r) => r.data);

export const deleteClass = (id) => client.delete(`/classes/${id}`).then((r) => r.data);

// ---- Ditari i plotë i një paraleleje ----

export const fetchRegister = (classId) =>
  client.get(`/classes/${classId}/register`).then((r) => r.data);

// ---- Lëndët ----

export const addSubject = (classId, data) =>
  client.post(`/classes/${classId}/subjects`, data).then((r) => r.data);

export const updateSubject = (subjectId, data) =>
  client.put(`/subjects/${subjectId}`, data).then((r) => r.data);

export const deleteSubject = (subjectId) =>
  client.delete(`/subjects/${subjectId}`).then((r) => r.data);

// ---- Notat ----

export const addGrade = (classId, data) =>
  client.post(`/classes/${classId}/grades`, data).then((r) => r.data);

export const deleteGrade = (gradeId) =>
  client.delete(`/grades/${gradeId}`).then((r) => r.data);

export const setFinalGrade = (classId, data) =>
  client.put(`/classes/${classId}/final-grade`, data).then((r) => r.data);

// ---- Kontrolli i notave ----

export const reviewGrade = (classId, data) =>
  client.post(`/classes/${classId}/reviews`, data).then((r) => r.data);

export const fetchGradeIssues = (status = 'error') =>
  client.get('/grade-issues', { params: { status } }).then((r) => r.data);

export const fetchGradeIssueCount = () =>
  client.get('/grade-issues/count').then((r) => r.data);

export const closeGradeIssue = (id, status) =>
  client.put(`/grade-issues/${id}`, { status }).then((r) => r.data);

// ---- Kërkesat për ndryshimin e notës së mbyllur ----

export const createEditRequest = (classId, data) =>
  client.post(`/classes/${classId}/edit-requests`, data).then((r) => r.data);

export const fetchEditRequests = (status = 'pending') =>
  client.get('/edit-requests', { params: { status } }).then((r) => r.data);

export const fetchEditRequestCount = () =>
  client.get('/edit-requests/count').then((r) => r.data);

export const decideEditRequest = (id, status, note) =>
  client.put(`/edit-requests/${id}`, { status, note }).then((r) => r.data);

export const cancelEditRequest = (id) =>
  client.delete(`/edit-requests/${id}`).then((r) => r.data);

// ---- Rendi i nxënësve ----

export const saveStudentOrder = (classId, studentIds) =>
  client.put(`/classes/${classId}/order`, { student_ids: studentIds }).then((r) => r.data);

// ---- Mungesat / sjellja / vërejtja ----

export const saveStudentMeta = (classId, studentId, data) =>
  client.put(`/classes/${classId}/meta/${studentId}`, data).then((r) => r.data);