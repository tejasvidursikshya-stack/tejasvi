import { securityHeaders, privateHeaders } from './lib/security-headers.ts';
/** @type {import('next').NextConfig} */
const nextConfig = {
 poweredByHeader: false,
 skipTrailingSlashRedirect:true,
 serverExternalPackages: ['pg'],
 async headers() {
  return [
   {source:'/:path*',headers:securityHeaders(process.env.APP_URL || 'http://localhost:3000',process.env.NODE_ENV === 'development')},
   ...['/erp/:path*','/api/:path*','/certificate/:path*','/login/:path*','/school/:path*','/workspace/:path*','/assistant','/staff','/change-password','/demo','/classic'].map(source=>({source,headers:privateHeaders})),
   ...(process.env.INDEX_PUBLIC_SITE === 'true' ? [] : [{source:'/:path*',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow, noarchive'}]}])
  ];
 }
};
export default nextConfig;
