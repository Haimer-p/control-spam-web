const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Dev local: ưu tiên .env.local trong control-spam-web, fallback .env repo bot (../.env)
const localEnv = path.join(__dirname, '.env.local');
const rootEnv = path.join(__dirname, '..', '.env');
if (fs.existsSync(localEnv)) {
  dotenv.config({ path: localEnv });
} else if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['mongoose'],
  },
};

module.exports = nextConfig;
