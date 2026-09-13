require('dotenv').config();

const requiredVars = [
  'GEMINI_API_KEY',
  'MONGODB_URI',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'GOOGLE_REFRESH_TOKEN',
  'BLOGGER_BLOG_ID'
];

const missingVars = requiredVars.filter(envVar => !process.env[envVar]);

if (missingVars.length > 0) {
  console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

module.exports = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
  MONGODB_URI: process.env.MONGODB_URI,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
  BLOGGER_BLOG_ID: process.env.BLOGGER_BLOG_ID,
  PORT: process.env.PORT || 3000,
  CRON_SCHEDULE: process.env.CRON_SCHEDULE || '*/2 * * * *',
  ADMIN_API_KEY: process.env.ADMIN_API_KEY || null
};
