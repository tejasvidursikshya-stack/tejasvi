import {isIP} from 'node:net';
// Only enable a header that the reverse proxy OVERWRITES. Never trust a
// client-provided X-Forwarded-For list. The app port must not be public.
export function loginSource(request:Request,env=process.env){
 const header=env.LOGIN_IP_HEADER;
 if(!header)return null;
 if(!['x-real-ip','cf-connecting-ip'].includes(header))throw new Error('Invalid LOGIN_IP_HEADER configuration');
 const value=request.headers.get(header)?.trim()||'';
 if(!isIP(value))throw new Error('Trusted login source header is missing or invalid');
 return value;
}
