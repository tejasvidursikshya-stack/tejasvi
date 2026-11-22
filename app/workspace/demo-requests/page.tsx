import {redirect} from 'next/navigation';
import {getUser} from '@/lib/auth';
import {inbox} from '@/lib/demo-requests';
import {isRequestStatus,statuses} from '@/lib/demo-options';
import {RequestRow} from './request-row';
import './inbox.css';
export const dynamic='force-dynamic';
export const metadata={title:'Demo requests | Tejasvi Campus',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{status?:string;page?:string}>}){
 const u=await getUser();if(!u)redirect('/login');if(u.mustChangePassword)redirect('/change-password');if(!u.platformAdmin)redirect('/workspaces');
 const q=await searchParams,status=isRequestStatus(q.status)?q.status:'all',page=typeof q.page==='string'&&/^[1-9]\d{0,4}$/.test(q.page)?Math.min(50001,Number(q.page)):1;
 const {entries,more}=await inbox(status,page),href=(s:string,p=1)=>'/workspace/demo-requests?status='+s+'&page='+p;
 return <main className="tr-inbox"><div className="tr-wrap"><header><a href="/workspaces">← My workspaces</a><span>Platform Super Admin</span></header><p className="tr-kicker">TEJASVI CAMPUS / ENQUIRIES</p><h1>Demo requests</h1><p>Review walkthrough requests from the public homepage. Contact the person by email to agree a time, then update their status here.</p>
 <nav aria-label="Filter demo requests">{['all',...statuses].map(s=><a key={s} href={href(s)} aria-current={s===status?'page':undefined}>{s}</a>)}</nav>
 {entries.length?<div className="tr-list">{entries.map(row=><RequestRow key={row.id+'-'+row.status} row={row}/>)}</div>:<section className="tr-empty"><h2>No requests in this view</h2><p>{status==='all'&&page===1?'Requests will appear here when someone submits the walkthrough form.':'Choose a different status or return to the first page.'}</p></section>}
 <footer>{page>1&&<a href={href(status,page-1)}>← Previous</a>}<span>Page {page}</span>{more&&<a href={href(status,page+1)}>Next →</a>}</footer></div></main>;
}
