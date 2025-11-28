import "dotenv/config";

export type AppEnvironment = "development" | "production" | "test";

export interface AppConfig {
  env: AppEnvironment;
}

function resolveEnv(): AppEnvironment {
  const raw = process.env.NODE_ENV?.toLowerCase();

  if (raw === "production") return "production";
  if (raw === "test") return "test";
  // Default to development
  return "development";
}

export const config: AppConfig = {
  env: resolveEnv(),
};

