import axios from "axios";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "";

export const api = axios.create({
  baseURL: `${SERVER_URL}/api`,
  withCredentials: true,
});

// Automatically inject Authorization Bearer token header for 100% reliable cross-domain authentication
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("chatly_access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing: Promise<unknown> | null = null;

api.interceptors.response.use(
  (res) => {
    // If backend returns an accessToken in JSON payload, save it to localStorage for Bearer fallback
    if (res.data?.accessToken) {
      localStorage.setItem("chatly_access_token", res.data.accessToken);
    }
    return res;
  },
  async (error) => {
    const original = error.config;
    const isRefreshOrAuthRequest =
      original?.url?.includes("/auth/refresh") ||
      original?.url?.includes("/auth/login") ||
      original?.url?.includes("/auth/register") ||
      original?.url?.includes("/auth/guest");

    if (error.response?.status === 401 && !original._retry && !isRefreshOrAuthRequest) {
      original._retry = true;
      refreshing ??= api.post("/auth/refresh").then((r) => {
        if (r.data?.accessToken) {
          localStorage.setItem("chatly_access_token", r.data.accessToken);
        }
        return r;
      }).finally(() => (refreshing = null));

      try {
        await refreshing;
        const newToken = localStorage.getItem("chatly_access_token");
        if (newToken) {
          original.headers.Authorization = `Bearer ${newToken}`;
        }
        return api(original);
      } catch {
        localStorage.removeItem("chatly_access_token");
      }
    }
    return Promise.reject(error);
  },
);
