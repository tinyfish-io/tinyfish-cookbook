/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },

  // The snapshot store reads data/ at request time through a path built from
  // process.cwd(), which the bundler cannot see and therefore will not ship.
  // Without this the atlas deploys as an empty map: every read route 404s in
  // production while working perfectly in dev.
  outputFileTracingIncludes: {
    '/api/**': ['./data/**/*'],
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }]
  },
}

export default nextConfig
