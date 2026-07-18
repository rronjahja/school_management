import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

/** Nxjerr mesazhin e gabimit nga pergjigja e serverit. */
export function errorMessage(err) {
  return (
    err?.response?.data?.error ||
    'Nuk u arrit lidhja me serverin. Kontrolloni nëse API është duke punuar.'
  );
}

export default client;
