export const env = {
  DATABASE_URL: process.env.DATABASE_URL || 'mongodb://localhost:27017/vionsys_cms',
  JWT_SECRET: process.env.JWT_SECRET || 'vionsys-cms-jwt-super-secret-key-2026',
  VIONSYS_FRONTEND_BASE_URL: process.env.VIONSYS_FRONTEND_BASE_URL || 'https://www.vionsys.com',
  FRONTEND_REVALIDATE_URL: process.env.FRONTEND_REVALIDATE_URL || 'https://www.vionsys.com/api/revalidate/cms',
  FRONTEND_REVALIDATE_SECRET: process.env.FRONTEND_REVALIDATE_SECRET || 'vionsys-cms-revalidate-secret-2026',
  CMS_BASE_URL: process.env.CMS_BASE_URL || 'https://cms-vionsys-live.vercel.app',
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Google Gemini (AI document import + Ask AI). Server-only: never expose to the browser.
  GEMINI_API_KEY: process.env.GEMINI_API_KEY?.trim() || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite',
  GEMINI_EMBEDDING_MODEL: process.env.GEMINI_EMBEDDING_MODEL?.trim() || 'gemini-embedding-001',
};

// Simple sanity check
if (!process.env.DATABASE_URL && env.NODE_ENV === 'production') {
  console.warn('WARNING: DATABASE_URL is not set in environment variables! Using default fallback.');
}
if (!process.env.JWT_SECRET && env.NODE_ENV === 'production') {
  console.warn('WARNING: JWT_SECRET is not set in environment variables! Using default fallback.');
}
