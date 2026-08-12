import axios from "axios";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "";

export const api = axios.create({
  baseURL: `${SERVER_URL}/api`,
  withCredentials: true,
});

let refreshing: Promise<unknown> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    // Exclude /auth/refresh itself and auth submission endpoints from triggering refresh loops
    const isRefreshOrAuthRequest =
      original?.url?.includes("/auth/refresh") ||
      original?.url?.includes("/auth/login") ||
      original?.url?.includes("/auth/register") ||
      original?.url?.includes("/auth/guest");

    if (error.response?.status === 401 && !original._retry && !isRefreshOrAuthRequest) {
      original._retry = true;
      refreshing ??= api.post("/auth/refresh").finally(() => (refreshing = null));
      try {
        await refreshing;
        return api(original);
      } catch {
        // Token refresh failed (e.g. session revoked or 30 days passed)
      }
    }
    return Promise.reject(error);
  },
);
