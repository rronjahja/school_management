import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  // Cookie-ja e sesionit derguar me cdo kerkese
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    // Kerkohet nga serveri si mbrojtje ndaj CSRF
    'X-Requested-With': 'XMLHttpRequest',
  },
});

/** Thirret kur sesioni skadon — vendoset nga AuthContext. */
let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const url = err?.config?.url || '';

    // 401 gjate hyrjes eshte kredencial i gabuar, jo sesion i skaduar
    if (status === 401 && !url.includes('/auth/login') && onUnauthorized) {
      onUnauthorized();
    }
    return Promise.reject(err);
  }
);

/** Nxjerr mesazhin e gabimit nga pergjigja e serverit. */
export function errorMessage(err) {
  return (
    err?.response?.data?.error ||
    'Nuk u arrit lidhja me serverin. Kontrolloni nëse API është duke punuar.'
  );
}

export default client;