import dotenv from "dotenv";

// Load environment variables
dotenv.config();

export const config = {
  // Database
  DATABASE_URL: `postgresql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:5432/${process.env.DATABASE_NAME}?connect_timeout=10&sslmode=require`,

  // JWT
  JWT_SECRET: process.env.JWT_SECRET as string,
  JWT_ACCESS_EXPIRE: process.env.JWT_ACCESS_EXPIRE || "15m",
  JWT_REFRESH_EXPIRE: process.env.JWT_REFRESH_EXPIRE || "7d",

  // Server
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || "development",

  // CORS
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "5"),

  // Security
  BCRYPT_SALT_ROUNDS: Number.parseInt(process.env.BCRYPT_SALT_ROUNDS || "12"),

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  
  // mail
  MJ_APIKEY_PRIVATE: process.env.MJ_APIKEY_PRIVATE,
  MJ_APIKEY_PUBLIC: process.env.MJ_APIKEY_PUBLIC,

  // Admin
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  ADMIN_USERNAME: process.env.ADMIN_USERNAME,
  ADMIN_FIRST_NAME: process.env.ADMIN_FIRST_NAME,
  ADMIN_LAST_NAME: process.env.ADMIN_LAST_NAME,
} as const;

// Validate required environment variables
const requiredEnvVars = ["DATABASE_URL", "JWT_SECRET"];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Required environment variable ${envVar} is not set`);
  }
}
