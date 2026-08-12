import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),

  databaseUrl: required("DATABASE_URL"),

  jwtSecret: process.env.JWT_SECRET ?? "chatly-default-jwt-secret-key-2026-secure",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? "chatly-default-jwt-refresh-secret-key-2026-secure",
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? "15m",
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30),

  storage: {
    endpoint: process.env.STORAGE_ENDPOINT ?? "",
    accessKey: process.env.STORAGE_ACCESS_KEY ?? "",
    secretKey: process.env.STORAGE_SECRET_KEY ?? "",
    bucket: process.env.STORAGE_BUCKET ?? "chatly-uploads",
  },

  jitsi: {
    domain: process.env.JITSI_DOMAIN ?? "8x8.vc",
    appId: process.env.JITSI_APP_ID ?? "",
    apiKey: process.env.JITSI_API_KEY ?? "",
  },

  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
  serverUrl: process.env.SERVER_URL ?? "http://localhost:4000",

  cookieDomain: process.env.COOKIE_DOMAIN ?? undefined,
};
