function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  // Auth
  AUTH_SECRET: optional("AUTH_SECRET"),
  AUTH_URL: optional("AUTH_URL"),
  AUTH_GOOGLE_ID: optional("AUTH_GOOGLE_ID"),
  AUTH_GOOGLE_SECRET: optional("AUTH_GOOGLE_SECRET"),

  // Database
  get DATABASE_URL(): string {
    const value = process.env.DATABASE_URL;
    if (value) {
      return value;
    }

    // Next.js evaluates auth routes at build time; allow a placeholder connection string.
    if (process.env.NEXT_PHASE === "phase-production-build") {
      return "postgresql://build:build@localhost:5432/build";
    }

    return required("DATABASE_URL");
  },

  // Gemini (server-only)
  GOOGLE_GENERATIVE_AI_API_KEY: optional("GOOGLE_GENERATIVE_AI_API_KEY"),
  GEMINI_CHAT_MODEL: optional("GEMINI_CHAT_MODEL", "gemini-3.5-flash"),
  GEMINI_VOICE_MODEL: optional(
    "GEMINI_VOICE_MODEL",
    "gemini-3.1-flash-live-preview",
  ),
  GEMINI_EMBED_MODEL: optional("GEMINI_EMBED_MODEL", "gemini-embedding-2"),
  GEMINI_EMBED_DIMENSIONS: Number.parseInt(
    optional("GEMINI_EMBED_DIMENSIONS", "768"),
    10,
  ),

  // Master prompt (server-only)
  MASTER_SYSTEM_PROMPT: optional("MASTER_SYSTEM_PROMPT"),

  // Stripe
  STRIPE_SECRET_KEY: optional("STRIPE_SECRET_KEY"),
  STRIPE_WEBHOOK_SECRET: optional("STRIPE_WEBHOOK_SECRET"),
  STRIPE_PRICE_AGENT_SEAT: optional("STRIPE_PRICE_AGENT_SEAT"),

  // Context upload limits
  MAX_CONTEXT_FILE_BYTES: Number.parseInt(
    optional("MAX_CONTEXT_FILE_BYTES", "10485760"),
    10,
  ),
  FREE_CONTEXT_FILE_LIMIT: Number.parseInt(
    optional("FREE_CONTEXT_FILE_LIMIT", "3"),
    10,
  ),

  // Sales CRM integration
  SALES_CRM_URL: optional("SALES_CRM_URL"),
  SALES_CRM_OAUTH_CLIENT_ID: optional("SALES_CRM_OAUTH_CLIENT_ID"),
  SALES_CRM_OAUTH_CLIENT_SECRET: optional("SALES_CRM_OAUTH_CLIENT_SECRET"),
  INTEGRATION_ENCRYPTION_KEY: optional("INTEGRATION_ENCRYPTION_KEY"),
} as const;
