import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:8000",
  timeout: 30000,
});

const getSessionToken = () => {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  if (user?.role === "staff") {
    return localStorage.getItem("staff_token");
  }
  if (user?.role === "broker") {
    return localStorage.getItem("broker_token");
  }

  return localStorage.getItem("broker_token") || localStorage.getItem("staff_token");
};

const clearSession = () => {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  if (user?.role === "staff") {
    localStorage.removeItem("staff_token");
    localStorage.removeItem("staff_user");
  } else {
    localStorage.removeItem("broker_token");
    localStorage.removeItem("broker_user");
  }
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

api.interceptors.request.use((config) => {
  const token = getSessionToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearSession();
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
