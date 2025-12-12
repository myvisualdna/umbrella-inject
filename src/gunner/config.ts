/**
 * Configuration for Sanity CMS Gunner
 */

export const SANITY_GUNNER_ENABLED = process.env.SANITY_GUNNER_ENABLED === "true";

// Support both NEXT_PUBLIC_ prefixed and non-prefixed environment variables
export const SANITY_PROJECT_ID = 
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 
  process.env.SANITY_PROJECT_ID || 
  "";

export const SANITY_DATASET = 
  process.env.NEXT_PUBLIC_SANITY_DATASET || 
  process.env.SANITY_DATASET || 
  "production";

// Use write token for mutations (create/update/delete)
export const SANITY_API_TOKEN = 
  process.env.SANITY_API_WRITE_TOKEN || 
  process.env.SANITY_API_TOKEN || 
  "";
