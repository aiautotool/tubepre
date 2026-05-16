/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'i.ytimg.com',
            },
            {
                protocol: 'https',
                hostname: 'yt3.ggpht.com',
            },
        ],
    },
    async rewrites() {
        const apiBase = process.env.KVTUBE_INTERNAL_API_BASE_URL || 'http://localhost:8080';
        return [
            {
                source: '/api/:path*',
                destination: `${apiBase}/api/:path*`,
            },
        ];
    },
};

export default nextConfig;
