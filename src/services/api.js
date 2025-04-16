import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
});

API.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const getTeacherEmailByName = async (name) => {
  try {
    const normalized = name.trim().replace(/\s+/g, ' ');
    const res = await API.get(`/teachers?name=${encodeURIComponent(normalized)}`);
    return res.data?.email || '';
  } catch (err) {
    console.error("❌ ไม่พบอีเมลอาจารย์:", err.response?.data?.message || err.message);
    return '';
  }
};

export default API;
