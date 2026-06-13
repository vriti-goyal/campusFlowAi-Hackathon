// src/lib/api.js
import axios from 'axios';
import { auth } from '@/lib/firebase';

let interceptorsInitialized = false;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
  headers: { 'Content-Type': 'application/json' },
});

// Attach the Firebase idToken to every request (set by AuthContext)
export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

let currentToastFn = null;

export function setupInterceptors(toastFn) {
  currentToastFn = toastFn;
  if (interceptorsInitialized) return;
  interceptorsInitialized = true;

  api.interceptors.request.use(
    async (config) => {
      if (auth.currentUser) {
        try {
          const freshToken = await auth.currentUser.getIdToken(true);
          config.headers['Authorization'] = `Bearer ${freshToken}`;
        } catch (error) {
          console.error('Error refreshing token:', error);
        }
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status >= 400 || error.status >= 400 || !error.response) {
        if (currentToastFn) {
          currentToastFn(error.response?.data?.error || error.message || 'An error occurred', 'error');
        }
      }
      return Promise.reject(error);
    }
  );
}

export default api;
