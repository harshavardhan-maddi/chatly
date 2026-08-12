import axios from "axios";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "";

export const api = axios.create({
  baseURL: `${SERVER_URL}/api`,
  withCredentials: true,
});

// On a 401, try refreshing the access token once, then retry the original
// request. If the refresh also fails, the caller's own error handling
// (e.g. redirect to /login) takes over.
let refreshing: Promise<unknown> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      refreshing ??= api.post("/auth/refresh").finally(() => (refreshing = null));
      try {
        await refreshing;
        return api(original);
      } catch {
        // fall through to reject below
      }
    }
    return Promise.reject(error);
  },
);
