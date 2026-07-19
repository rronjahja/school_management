import client from './client';

export const login = (username, password) =>
  client.post('/auth/login', { username, password }).then((r) => r.data.user);

export const logout = () => client.post('/auth/logout').then((r) => r.data);

export const fetchMe = () => client.get('/auth/me').then((r) => r.data.user);

export const fetchAuthStatus = () => client.get('/auth/status').then((r) => r.data);

export const changePassword = (current_password, new_password) =>
  client.post('/auth/change-password', { current_password, new_password }).then((r) => r.data);

// Menaxhimi i perdoruesve (vetem admin)
export const fetchUsers = () => client.get('/users').then((r) => r.data);
export const createUser = (data) => client.post('/users', data).then((r) => r.data);
export const updateUser = (id, data) => client.put(`/users/${id}`, data).then((r) => r.data);
export const resetUserPassword = (id, new_password) =>
  client.post(`/users/${id}/reset-password`, { new_password }).then((r) => r.data);