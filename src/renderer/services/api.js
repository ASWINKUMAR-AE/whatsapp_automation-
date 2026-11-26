import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorData = error.response?.data || {};
    console.error('API Error:', errorData);
    return Promise.reject(errorData);
  }
);

export const getStatus = async () => {
  const response = await api.get('/status');
  return response.data;
};

export const sendMessage = async (recipient, text) => {
  const response = await api.post(`/send?recipient=${encodeURIComponent(recipient)}&text=${encodeURIComponent(text || '')}`);
  return response.data;
};

export const sendRemoteImage = async (recipient, file, text = '') => {
  const response = await api.post(`/send?recipient=${encodeURIComponent(recipient)}&file=${encodeURIComponent(file)}&text=${encodeURIComponent(text)}`);
  return response.data;
};

export const sendRemoteDocument = async (recipient, document, text = '') => {
  const response = await api.post(`/send?recipient=${encodeURIComponent(recipient)}&document=${encodeURIComponent(document)}&text=${encodeURIComponent(text)}`);
  return response.data;
};

export const sendLocalMedia = async (recipient, text, base64File, fileName, mimeType) => {
  const response = await api.post('/send', {
    recipient,
    text,
    base64File,
    fileName,
    mimeType
  });
  return response.data;
};

export const getLogs = async (type = 'all', search = '') => {
  const params = new URLSearchParams();
  if (type !== 'all') params.append('type', type);
  if (search) params.append('search', search);
  const response = await api.get(`/logs?${params.toString()}`);
  return response.data;
};

export const getGroupInfo = async () => {
  const response = await api.get('/group-info');
  return response.data;
};

export const getContacts = async () => {
  const response = await api.get('/contacts');
  return response.data;
};

export const getChats = async () => {
  const response = await api.get('/chats');
  return response.data;
};

export const getChatMessages = async (chatId, limit = 50) => {
  const response = await api.get(`/chats/${encodeURIComponent(chatId)}/messages?limit=${limit}`);
  return response.data;
};

export const healthCheck = async () => {
  const response = await api.get('/health');
  return response.data;
};

export const login = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

export const register = async (name, email, password) => {
  const response = await api.post('/auth/register', { name, email, password });
  return response.data;
};

export const getMe = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const getSubscriptionPlans = async () => {
  const response = await api.get('/subscription/plans');
  return response.data;
};

export const getSubscriptionStatus = async () => {
  const response = await api.get('/subscription/status');
  return response.data;
};

export const upgradeSubscription = async (plan, duration = 30) => {
  const response = await api.post('/subscription/upgrade', { plan, duration });
  return response.data;
};

export const uploadPayment = async (planId, duration, file) => {
  const formData = new FormData();
  formData.append('planId', planId);
  formData.append('duration', duration);
  formData.append('screenshot', file);

  const response = await api.post('/subscription/upload-payment', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const getAdminPayments = async () => {
  const response = await api.get('/subscription/admin/payments');
  return response.data;
};

export const approvePayment = async (paymentId, status) => {
  const response = await api.post('/subscription/admin/payments/approve', { paymentId, status });
  return response.data;
};

export const getUsage = async () => {
  const response = await api.get('/subscription/usage');
  return response.data;
};

export const reconnectWhatsApp = async () => {
  const response = await api.post('/reconnect');
  return response.data;
};

export const refreshQR = async () => {
  const response = await api.post('/refresh-qr');
  return response.data;
};

export const logoutDevice = async () => {
  const response = await api.post('/logout-device');
  return response.data;
};

export default api;
