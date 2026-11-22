import {one} from '@/lib/db';
import {jsonValue} from '@/lib/platform-server';
import {notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export const metadata={title:'Certificate verification',robots:{index:false,follow:false}};
export default async function CertificateVerification({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))notFound();const c=await one('SELECT snapshot,revoked_at FROM certificates WHERE id=?',[id]);if(!c)notFound();const s=jsonValue(c.snapshot);return <main style={{maxWidth:680,margin:'60px auto',padding:30}}><p>Certificate verification</p><h1>{c.revoked_at?'Certificate revoked':'Verified certificate'}</h1><h2>{s.organization}</h2><p>Awarded to <strong>{s.learner}</strong> for <strong>{s.course}</strong>.</p><p>Issued {s.date}</p><p>Certificate ID: {id}</p><p>{c.revoked_at?'This credential is no longer valid.':'This credential matches the issuing organization’s stored record.'}</p></main>}
