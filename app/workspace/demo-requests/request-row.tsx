'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {reference,statuses,type RequestStatus} from '@/lib/demo-options';
import type {InboxEntry} from '@/lib/demo-requests';
export function RequestRow({row}:{row:InboxEntry}){
 const router=useRouter(),[selected,setSelected]=useState<RequestStatus>(row.status),[busy,setBusy]=useState(false),[note,setNote]=useState('');
 async function save(){if(busy||selected===row.status)return;setBusy(true);setNote('');try{const r=await fetch('/api/owner/demo-requests',{method:'PATCH',headers:{'Content-Type':'application/json','x-tejasvi-request':'1'},body:JSON.stringify({id:row.id,status:selected,previous:row.status})});const data=await r.json();if(!r.ok)throw Error(data.error||'Could not save the status.');setNote('Status saved.');router.refresh();}catch(e){setNote((e as Error).message||'Could not save. Please try again.');}finally{setBusy(false);}}
 return <article><div><p className="tr-meta">{row.audience} · {reference(row.id)} · {row.created_at.slice(0,16)} UTC</p><h2>{row.organization_name}</h2><p>{row.contact_name} · <a href={'mailto:'+row.contact_email}>{row.contact_email}</a></p>{row.interests&&<p className="tr-interest">{row.interests}</p>}</div><div className="tr-update"><label>Status<select value={selected} onChange={e=>setSelected(e.target.value as RequestStatus)}>{statuses.map(s=><option key={s}>{s}</option>)}</select></label><button type="button" disabled={busy||selected===row.status} onClick={save}>{busy?'Saving…':'Save status'}</button>{note&&<p role="status">{note}</p>}</div></article>;
}
