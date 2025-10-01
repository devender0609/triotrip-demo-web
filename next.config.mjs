/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      // Allow client fetches to your own API (and Duffel/Teleport if you ever call them client-side)
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.duffel.com https://api.teleport.org",
              "frame-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self'"
            ].join("; ")
          }
        ]
      },
      // (Optional) extra CORS headers for API routes; your route already sets them
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, Duffel-Version" },
          { key: "Access-Control-Max-Age", value: "86400" }
        ]
      }
    ];
  },

  // IMPORTANT: do NOT add any rewrites for /api/:path*
};

module.exports = nextConfig;
