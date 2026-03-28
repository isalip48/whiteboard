/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  allowedDevOrigins: [
    '192.168.1.10',    // your local network IP
    'localhost',
  ],
};

export default nextConfig;