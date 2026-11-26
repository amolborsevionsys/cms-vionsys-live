export const siteConfig = {
  name: 'Vionsys CMS',
  description: 'Premium no-code publishing platform for Vionsys blogs and case studies.',
  cmsUrl: process.env.CMS_BASE_URL || 'https://cms-vionsys-live.vercel.app',
  frontendUrl: process.env.VIONSYS_FRONTEND_BASE_URL || 'https://www.vionsys.com',
  // Revalidation URL/secret live in src/lib/env.ts (server-only). This file is
  // also bundled into client components, so it must never contain secrets.

  // Storage Configurations
  storage: {
    uploadDir: 'public/uploads',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/svg+xml',
      'video/mp4',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
      'application/vnd.openxmlformats-officedocument.presentationml.presentation' // pptx
    ]
  },

  // Author and Content defaults
  defaults: {
    seoTitleTemplate: '%s | Vionsys',
    orgName: 'Vionsys IT Solutions India Pvt. Ltd.',
    orgLogoUrl: 'https://vionsys.com/assets/images/logo.png',
    orgUrl: 'https://vionsys.com'
  }
};
