import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 30000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('oooa_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('oooa_token');
      if (!location.pathname.startsWith('/login')) location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export const errMsg = (e: any) => {
  const m = e?.response?.data?.message;
  if (Array.isArray(m)) return m.join('；');
  return m || e?.message || '操作失败';
};

export default api;
