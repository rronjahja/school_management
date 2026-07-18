import client from './client';

export const fetchStudents = (params = {}) =>
  client.get('/students', { params }).then((r) => r.data);

export const fetchStudent = (id) =>
  client.get(`/students/${id}`).then((r) => r.data);

export const createStudent = (data) =>
  client.post('/students', data).then((r) => r.data);

export const updateStudent = (id, data) =>
  client.put(`/students/${id}`, data).then((r) => r.data);

export const deleteStudent = (id) =>
  client.delete(`/students/${id}`).then((r) => r.data);

/** Shkarkon dokumentin Word te regjistrimit si skedar. */
export async function downloadRegistrationDoc(id, fullName) {
  try {
    const res = await client.get(`/students/${id}/registration-doc`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Regjistrimi_${fullName.replace(/\s+/g, '_')}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    // Gabimet vijne si blob kur responseType eshte 'blob' - i kthejme ne JSON
    if (err.response?.data instanceof Blob) {
      const text = await err.response.data.text();
      try {
        err.response.data = JSON.parse(text);
      } catch {
        err.response.data = { error: text };
      }
    }
    throw err;
  }
}
