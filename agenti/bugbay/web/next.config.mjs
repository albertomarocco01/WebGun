/** @type {import('next').NextConfig} */
const nextConfig = {
  // Il widget è caricato cross-origin (app utente su :3000 → daemon su :7331)
  // come <script type="module">, che RICHIEDE CORS sulla risposta. Gli header
  // qui valgono anche per i file statici di public/.
  async headers() {
    return [
      {
        source: '/bugbay-widget.js',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
      {
        // Allegati serviti da public/: MIME già ristretto a immagini/video
        // (no svg/html), ma nosniff impedisce al browser di re-interpretare
        // i byte come HTML → nessuna esecuzione di script dal dominio daemon.
        source: '/bugbay-uploads/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Content-Security-Policy', value: "default-src 'none'; sandbox" },
        ],
      },
    ];
  },
};

export default nextConfig;
