import type { NextConfig } from "next";

// Permissions-Policy: deny camera + geolocation; allow microphone on the
// same origin so the in-app voice Q&A flow can call getUserMedia.
const permissionsPolicy = ["camera=()", "microphone=(self)", "geolocation=()"].join(", ");

// CSP — restrictive baseline. 'unsafe-eval' is only allowed in dev
// (Turbopack HMR). 'unsafe-inline' on script remains until we wire nonce
// middleware (Next.js injects inline boot scripts during hydration).
// Inline styles are permitted in both modes for Tailwind/shadcn.
const isProd = process.env.NODE_ENV === "production";
const scriptSrc = isProd
  ? "script-src 'self' 'unsafe-inline'"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

const csp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://api.anthropic.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: permissionsPolicy },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
