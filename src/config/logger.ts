import { config } from "./env";

type LogLevel = "debug" | "info" | "warn" | "error";

function log(level: LogLevel, message: string, meta?: unknown) {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

  if (meta !== undefined) {
    // eslint-disable-next-line no-console
    console.log(base, JSON.stringify(meta, null, 2));
  } else {
    // eslint-disable-next-line no-console
    console.log(base);
  }
}

export const logger = {
  debug: (message: string, meta?: unknown) => {
    if (config.env === "development") {
      log("debug", message, meta);
    }
  },
  info: (message: string, meta?: unknown) => log("info", message, meta),
  warn: (message: string, meta?: unknown) => log("warn", message, meta),
  error: (message: string, meta?: unknown) => log("error", message, meta),
};

