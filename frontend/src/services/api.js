import axios from 'axios';

// Resolve API base URL dynamically from environment variable or fallback to relative path
export const API_BASE_URL = import.meta.env.VITE_API_URL
  ? String(import.meta.env.VITE_API_URL).trim().replace(/\/+$/, '')
  : '';


export const API_V1_URL = `${API_BASE_URL}/api/v1`;

const api = axios.create({
  baseURL: API_V1_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Token & Start Slow Network Timer
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Start a timer to check for slow network (e.g. > 3 seconds)
    config._timer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('slow-network', { detail: { isSlow: true } }));
    }, 3000);

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Automatic JWT Refresh & Clear Timers
api.interceptors.response.use(
  (response) => {
    if (response.config._timer) {
      clearTimeout(response.config._timer);
      window.dispatchEvent(new CustomEvent('slow-network', { detail: { isSlow: false } }));
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');

      if (refreshToken) {
        try {
          const res = await axios.post(`${API_V1_URL}/auth/refresh/`, { refresh: refreshToken });
          if (res.status === 200) {
            localStorage.setItem('access_token', res.data.access);
            api.defaults.headers.common['Authorization'] = `Bearer ${res.data.access}`;
            originalRequest.headers['Authorization'] = `Bearer ${res.data.access}`;
            return api(originalRequest);
          }
        } catch (refreshErr) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          window.dispatchEvent(new Event('session-expired'));
        }
      } else {
        window.dispatchEvent(new Event('session-expired'));
      }
    }

    if (error.config?._timer) {
      clearTimeout(error.config._timer);
      window.dispatchEvent(new CustomEvent('slow-network', { detail: { isSlow: false } }));
    }

    return Promise.reject(error);
  }
);

export default api;

