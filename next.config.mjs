/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "bardata.vercel.app",
          },
        ],
        destination: "https://www.bardata.app/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
