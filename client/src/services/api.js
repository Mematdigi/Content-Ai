import axios from 'axios';

/**
 * Single axios instance for the whole frontend. The Vite dev server
 * proxies /api -> backend, so we use a relative base URL.
 *
 * The request interceptor pulls the JWT from localStorage on every call
 * so we don't have to thread it through every component.
 *
 * The response interceptor logs the user out on 401 (auth has expired or
 * the token has been revoked) so they're prompted to sign in again.
 */
const api = axios.create({
  baseURL: '/api',
  timeout: 120000, // generation can take a while
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cf_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('cf_token');
      localStorage.removeItem('cf_user');
      // Hard reload so all redux state resets cleanly.
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
