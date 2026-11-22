'use client';
import {useState} from 'react';
export default function Signout(){const [error,setError]=useState(false);return <><button type="button" onClick={async()=>{try{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json','x-tejasvi-request':'1'},body:'{}'});if(!r.ok)throw Error();location.assign('/login');}catch{setError(true);}}}>Sign out</button>{error&&<small role="alert">Please try again.</small>}</>;}
