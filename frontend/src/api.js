import axios from 'axios';

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3005`, // Backend URL (Env or Dynamic Fallback)
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Her istekte token'ı otomatik ekle
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // FormData isteklerinde tarayıcı boundary'yi kendi koymalı.
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  return config;
});

export default api;
