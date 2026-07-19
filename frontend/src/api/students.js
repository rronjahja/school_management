import client from './client';

export const fetchStudents = (params = {}) =>
  client.get('/students', { params }).then((r) => r.data);

export const fetchStudent = (id) =>
  client.get(`/students/${id}`).then((r) => r.data);

/** Numri i radhes i kontrates per drejtimin + gjeneraten e zgjedhur. */
export const fetchNextContractNumber = (category_id, generation, enrollment_date) =>
  client
    .get('/students/next-contract-number', {
      params: { category_id, generation, enrollment_date },
    })
    .then((r) => r.data.contract_number);

export const createStudent = (data) =>
  client.post('/students', data).then((r) => r.data);

export const updateStudent = (id, data) =>
  client.put(`/students/${id}`, data).then((r) => r.data);

export const deleteStudent = (id) =>
  client.delete(`/students/${id}`).then((r) => r.data);

export const fetchTemplates = () =>
  client.get('/templates').then((r) => r.data);

/** Shkarkon nje dokument Word te gjeneruar nga shablloni i zgjedhur. */
export async function downloadDocument(id, fullName, templateFile) {
  try {
    const res = await client.get(`/students/${id}/document`, {
      params: templateFile ? { template: templateFile } : {},
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    const base = templateFile ? templateFile.replace(/\.docx$/i, '') : 'Dokument';
    a.download = `${base}_${fullName.replace(/\s+/g, '_')}.docx`;
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