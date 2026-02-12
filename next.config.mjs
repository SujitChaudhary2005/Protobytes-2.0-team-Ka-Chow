/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    images: {
        domains: [],
    },
    // Capacitor compatibility
    output: 'standalone',
};

export default nextConfig;

