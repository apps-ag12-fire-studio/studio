
import type {NextConfig} from 'next';

// Forcing a change to trigger environment reload
const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // This allows the Next.js development server to accept requests
    // from the Firebase Studio environment.
    allowedDevOrigins: ["*.cloudworkstations.dev"],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com', // Added for Firebase Storage
        port: '',
        pathname: '/**',
      },
       {
        protocol: 'https',
        hostname: 'api.qrserver.com', // Added for QR Code generation
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;
