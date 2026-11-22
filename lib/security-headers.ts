// Baseline CSP. Inline scripts remain required by the current Next.js renderer.
export function securityHeaders(origin: string, development = false) {
 const https = origin.startsWith('https://');
 const csp = ["default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'self'", "form-action 'self'", `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ''}`, "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https:", "font-src 'self' data:", "connect-src 'self' https: wss:" + (development ? ' ws:' : ''), "media-src 'self' blob: https:", "worker-src 'self' blob:", "frame-src 'self' blob: https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com", ...(https ? ['upgrade-insecure-requests'] : [])].join('; ');
 return [
  {key:'Content-Security-Policy',value:csp},
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
  {key:'X-Frame-Options',value:'SAMEORIGIN'},
  {key:'Permissions-Policy',value:'camera=(), microphone=(self), geolocation=(), payment=(), usb=()'},
  ...(https ? [{key:'Strict-Transport-Security',value:'max-age=31536000'}] : [])
 ];
}
export const privateHeaders = [
 {key:'X-Robots-Tag',value:'noindex, nofollow, noarchive'},
 {key:'Cache-Control',value:'private, no-store'}
];
