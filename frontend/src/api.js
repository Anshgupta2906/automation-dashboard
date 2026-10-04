import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:8000",
  timeout: 30000,
});

const getSessionRole = () => {
  if (window.location.pathname.startsWith("/staff")) return "staff";
  if (window.location.pathname.startsWith("/dashboard")) return "broker";

  const staffUser = JSON.parse(localStorage.getItem("staff_user") || "null");
  const brokerUser = JSON.parse(localStorage.getItem("broker_user") || "null");
  if (staffUser?.role === "staff" && !brokerUser) return "staff";
  return "broker";
};

const getSessionToken = () => {
  return getSessionRole() === "staff"
    ? localStorage.getItem("staff_token")
    : localStorage.getItem("broker_token");
};

const clearSession = () => {
  if (getSessionRole() === "staff") {
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
