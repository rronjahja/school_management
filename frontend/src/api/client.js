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

/**
 * Mesazhi i gabimit — sipas asaj qe VERTET ndodhi.
 *
 * Versioni i vjeter kthente «nuk u arrit lidhja me serverin» per cdo gabim
 * pa `err.response.data.error`. Keshtu nje gabim JavaScript brenda faqes
 * (p.sh. thirrja e nje funksioni te fshire) dukej si problem rrjeti a baze
 * te dhenash, dhe kerkimi niste ne vendin e gabuar. Kater rastet ndahen:
 *   1. serveri u pergjigj me mesazh    -> mesazhi i tij
 *   2. serveri u pergjigj pa mesazh    -> statusi HTTP
 *   3. kerkesa nuk mori pergjigje      -> problem rrjeti
 *   4. gabim brenda faqes              -> mesazhi i vete gabimit
 */
export function errorMessage(err) {
  // 1 & 2 — pati pergjigje nga serveri
  if (err?.response) {
    const data = err.response.data;
    if (typeof data === 'string' && data.trim()) return data.trim();
    if (data?.error) return data.error;
    if (err.response.status === 401) return 'Sesioni ka skaduar. Hyni sërish.';
    if (err.response.status === 403) return 'Nuk keni të drejta për këtë veprim.';
    if (err.response.status === 404) return 'Burimi i kërkuar nuk u gjet.';
    return `Serveri ktheu gabimin ${err.response.status}.`;
  }

  // 3 — kerkesa u nis por s'mori pergjigje
  if (err?.request) {
    return 'Nuk u arrit lidhja me serverin. Kontrolloni nëse API është duke punuar.';
  }

  // 4 — gabim i faqes, jo i rrjetit
  if (err?.message) return `Gabim në faqe: ${err.message}`;

  return 'Ndodhi një gabim i papritur.';
}

export default client;