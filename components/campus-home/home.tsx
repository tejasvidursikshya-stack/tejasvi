'use client';
import {useEffect,useState} from 'react';
import {ArrowUpRight,ArrowUp,ArrowRight} from 'lucide-react';
import {localAsset,type Asset} from './media';
import {LaunchHero} from './launch';
import {Journeys,SharedTools,journeys,type Journey} from './journeys';
import {DetailedDemo} from './detailed-demo';
import {Walkthrough} from './walkthrough';
import {isAudience} from '../../lib/demo-options';
import type {Audience} from './operations-data';
function Header({asset,login}:{asset:Asset;login:string}){
 const [scrolled,setScrolled]=useState(false);
 useEffect(()=>{const on=()=>setScrolled(scrollY>60);on();addEventListener('scroll',on,{passive:true});return()=>removeEventListener('scroll',on);},[]);
 return <header className={'nh-header'+(scrolled?' nh-scrolled':'')}><div className="nh-bar"><a href="#top" className="nh-logo" aria-label="Tejasvi Campus home"><img src={asset('tejasvi-campus-logo.svg')} alt="Tejasvi Campus" width={875} height={170}/></a><div className="nh-actions"><a href={login} className="nh-signin">Sign in <ArrowRight size={15}/></a></div></div></header>;
}
function Footer({asset,workspace,login}:{asset:Asset;workspace:string;login:string}){
 return <footer className="tc-footer tl-foot"><div className="tc-bound"><div className="tc-foot-lead"><div><p className="tc-kicker"><i/> YOUR TEJASVI ACCOUNT</p><h2>Ready to sign in?</h2><p>Your organization and role determine which workspaces you can open.</p></div><a href={workspace} className="tc-foot-cta">My workspaces <ArrowUpRight size={20}/></a></div>
 <div className="tc-foot-main"><div className="tc-foot-id"><a href="#top" className="tl-brand tl-official-brand" aria-label="Tejasvi Campus, back to top"><img className="tl-brand-logo" src={asset('tejasvi-campus-logo.svg')} alt="Tejasvi Campus" width={875} height={170} decoding="async"/></a><span>A product of Dursikshya Education Network.</span></div><nav aria-label="Footer product navigation"><h3>Explore</h3><a href="#school-emis">School EMIS</a><a href="#college-emis">College EMIS</a><a href="#academic-lms">School &amp; College LMS</a><a href="#corporate-lms">Corporate LMS</a><a href="#demo">Product demo</a></nav><nav aria-label="Footer account navigation"><h3>Access</h3><a href={login}>Sign in</a><a href={workspace}>My workspaces</a><p>Need an account? Contact your institution’s administrator.</p></nav></div>
 <div className="tc-foot-base"><span>© {new Date().getFullYear()} Dursikshya Education Network</span><a href="#top">Back to top <ArrowUp size={14}/></a></div></div></footer>;
}
export default function CampusHome({asset=localAsset,site='',offlinePreview=false}:{asset?:Asset;site?:string;offlinePreview?:boolean}){
 const [journey,setJourney]=useState<Journey>('school-emis'),[request,setRequest]=useState<Audience|null>(null);
 useEffect(()=>{const sync=()=>{const q=new URLSearchParams(location.search),a=q.get('tour'),flow=journeys.find(j=>j.id===q.get('flow'));if(flow)setJourney(flow.id);else if(isAudience(a))setJourney(a==='school'?'school-emis':a==='corporate'?'corporate-lms':'college-emis');if(q.get('request')==='demo')setRequest(isAudience(a)?a:'college');};sync();window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);},[]);
 function choose(j:Journey){setJourney(j);const a=j==='school-emis'?'school':j==='corporate-lms'?'corporate':'college';try{if(location.protocol==='file:')return;const u=new URL(location.href);u.searchParams.set('tour',a);u.searchParams.set('flow',j);u.searchParams.delete('request');history.replaceState(history.state,'',u.pathname+u.search+u.hash);}catch{/* The local tour also works without the History API. */}}
 function dismiss(){setRequest(null);try{const u=new URL(location.href);if(u.searchParams.has('request')&&location.protocol!=='file:'){u.searchParams.delete('request');history.replaceState(history.state,'',u.pathname+u.search+u.hash);}}catch{}}
 return <div className="tc-home tl-home" id="top"><a className="tc-skip" href="#main">Skip to content</a><Header asset={asset} login={site+'/login'}/><main id="main"><LaunchHero asset={asset} onTour={a=>choose(a==='school'?'school-emis':a==='corporate'?'corporate-lms':'college-emis')} onRequest={setRequest}/><Journeys asset={asset} onDemo={choose}/><SharedTools asset={asset}/><DetailedDemo journey={journey} onChoose={choose} onRequest={setRequest}/></main><Footer asset={asset} login={site+'/login'} workspace={site+'/workspaces'}/>{request&&<Walkthrough audience={request} offline={offlinePreview} site={site} onDismiss={dismiss}/>}</div>;
}
