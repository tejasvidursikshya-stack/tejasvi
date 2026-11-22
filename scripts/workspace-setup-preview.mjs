import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import react from '@vitejs/plugin-react';

const root=fileURLToPath(new URL('../',import.meta.url));
const out=resolve(process.argv[2]||join(root,'build','workspace-setup-preview.html'));
const tmp=mkdtempSync(join(root,'.form-preview-'));
const read=(p)=>readFileSync(join(root,p),'utf8');
const uri=(name,type)=>'data:'+type+';base64,'+readFileSync(join(root,'public/assets',name)).toString('base64');
try{
  const entry=join(tmp,'client.tsx');
  writeFileSync(entry,`import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {OrganizationSetup} from '../components/platform/organization-setup';
const photos=JSON.parse(document.getElementById('photos').textContent);
function Preview(){
  const done=useRef(null);const [checked,setChecked]=useState(false);
  return <><div hidden={checked}><OrganizationSetup initialKind="school" busy={false} photo={key=>photos[key]} onSubmit={e=>{
    e.preventDefault();setChecked(true);requestAnimationFrame(()=>done.current?.focus());
  }}/></div>{checked&&<section className="preview-done"><h1 tabIndex={-1} ref={done}>Form complete</h1><p>This preview did not create a workspace or save your details. To create one, use the form in your running Tejasvi app.</p><button type="button" onClick={()=>{setChecked(false);requestAnimationFrame(()=>document.querySelector('.org-details-submit')?.focus());}}>Return to form</button></section>}</>;
}
createRoot(document.getElementById('form-root')).render(<Preview/>);`);
  const result=await build({root,configFile:false,plugins:[react()],logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{write:false,emptyOutDir:false,lib:{entry,formats:['iife'],name:'TejasviSetupPreview'},rolldownOptions:{output:{codeSplitting:false}}}});
  const code=(Array.isArray(result)?result:[result]).flatMap(r=>r.output).find(e=>e.type==='chunk').code;
  const photos=Object.fromEntries(['school','college','corporate','teacher'].map(k=>[k,uri('joy/'+k+'-small.webp','image/webp')]));
  const theme=read('app/globals.css').match(/:root\s*\{[^}]+\}/)[0];
  const fonts=[400,600,700].map(w=>'@font-face{font-family:Manrope;font-weight:'+w+';font-style:normal;font-display:swap;src:url('+uri('manrope-'+w+'.ttf','font/ttf')+') format("truetype")}').join('');
  const shell='*{box-sizing:border-box}html{font-size:100%}body{margin:0;background:#f4f7fb;color:var(--brand-ink);font:1rem/1.5 Manrope,system-ui,sans-serif}h1,h2,p{margin:0}button,input,textarea{font:inherit}button{cursor:pointer}img{display:block;max-width:100%}[hidden]{display:none!important}.preview-bar{max-width:67rem;margin:0 auto;padding:1rem;display:flex;align-items:center;justify-content:space-between;gap:.75rem;min-height:4.75rem;border-bottom:1px solid var(--brand-line);font-size:.875rem;color:var(--brand-muted)}.preview-bar img{width:7.25rem;height:auto}.preview-bar span{text-align:right}main{max-width:66rem;padding:.75rem 1rem 3rem;margin:auto}.preview-done{max-width:40rem;background:white;border:1px solid var(--brand-line);border-radius:1.35rem;margin:2rem auto;padding:2rem}.preview-done h1{line-height:1.2}.preview-done p{margin:1rem 0}.preview-done button{border:1px solid var(--brand-line-strong);border-radius:.55rem;padding:.6rem 1rem;color:var(--brand-ink);background:var(--brand-soft);font-weight:600}';
  const notices=[['Manrope','public/assets/FONT-LICENSE.txt'],['React','node_modules/react/LICENSE'],['React DOM','node_modules/react-dom/LICENSE'],['Lucide','node_modules/lucide-react/LICENSE']].map(([n,p])=>n+'\n'+read(p)).join('\n\n');
  const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; font-src data:; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; form-action \'none\'; base-uri \'none\'"><title>Workspace setup preview · Tejasvi</title><style>'+fonts+theme+shell+read('app/organization-bright.css')+'</style></head><body><header class="preview-bar"><img alt="Tejasvi" src="'+uri('tejasvi-logo.png','image/png')+'"><span>Form preview · Nothing is saved</span></header><main id="form-root"><noscript>Enable JavaScript to try the interactive form.</noscript></main><script type="application/json" id="photos">'+JSON.stringify(photos)+'</script><script>'+code.replace(/<\/script/gi,'<\\/script')+'</script><!-- '+notices.replaceAll('--','- -')+' --></body></html>';
  mkdirSync(dirname(out),{recursive:true});writeFileSync(out,html);console.log('Workspace setup preview: '+out);
}finally{rmSync(tmp,{recursive:true,force:true});}
