import client from './client';

// ---- Ditari i orëve të mësimit ----

export const fetchLessonClasses = () =>
    client.get('/lesson-classes').then((r) => r.data);

export const fetchLessonMonth = (classId, month) =>
    client.get(`/classes/${classId}/lessons`, { params: { month } }).then((r) => r.data);

export const createLesson = (classId, data) =>
    client.post(`/classes/${classId}/lessons`, data).then((r) => r.data);

export const updateLesson = (lessonId, data) =>
    client.put(`/lessons/${lessonId}`, data).then((r) => r.data);

export const deleteLesson = (lessonId) =>
    client.delete(`/lessons/${lessonId}`).then((r) => r.data);

export const reviewLesson = (lessonId, data) =>
    client.put(`/lessons/${lessonId}/review`, data).then((r) => r.data);

export const fetchHeldLessons = (params) =>
    client.get('/lessons/held', { params }).then((r) => r.data);

export const fetchReportFilters = () =>
    client.get('/lessons/filters').then((r) => r.data);

export const fetchLessonReport = (month, classId) =>
    client.get('/lessons/report', { params: { month, class_id: classId || undefined } })
        .then((r) => r.data);