'use client';
import {useState} from 'react';
import {Bell,CalendarDays,Check,Clock3,Signal,Wifi,BatteryFull} from 'lucide-react';
import type {Asset} from './media';
const views=[
 {name:'Calendar',icon:CalendarDays,title:'My calendar',date:'Wednesday · September 16',rows:[['09:00','Science lab','Scheduled class'],['11:30','Project consultation','Calendar event'],['15:00','Lab reflection due','Assignment deadline']]},
 {name:'Notices',icon:Bell,title:'My notices',date:'From your institution',rows:[['01','Library hours','Campus announcement'],['02','Room change','Class update'],['03','Project showcase','Institution notice']]}
] as const;
export function MobileChapter({asset}:{asset:Asset}){
 const [at,choose]=useState(0),v=views[at];
 return <section id="mobile" data-tc-chapter className="tm-mobile tm-chapter" aria-labelledby="tm-mobile-title"><div className="tc-bound tm-mobile-grid"><div><p className="tm-eyebrow"><span>04</span> / On your phone</p><h2 id="tm-mobile-title">What’s on today?</h2><p className="tm-mobile-sub">Check your calendar before class or catch an announcement on the way in. Open your institution’s Tejasvi workspace in your phone’s browser.</p><div className="tm-segmented" role="group" aria-label="Mobile preview">{views.map((v,i)=><button type="button" key={v.name} aria-pressed={i===at} onClick={()=>choose(i)}><v.icon size={16}/>{v.name}</button>)}</div></div>
 <div className="tm-handset-scene"><div className="tm-ring" aria-hidden="true"/><div className="tm-handset" aria-label={'Illustrative mobile '+v.name+' screen'}><div className="tm-status" aria-hidden="true"><b>09:41</b><i/><span><Signal size={12}/><Wifi size={12}/><BatteryFull size={16}/></span></div><div className="tm-screen"><img src={asset('tejasvi-logo.png')} alt="Tejasvi" width="78" height="22"/><p className="tm-smallcap">Workspace example</p><h3>{v.title}</h3><p>{v.date}</p><div className="tm-phone-rows" key={at}>{v.rows.map(([time,title,type])=><div key={title}><small>{time}</small><span><b>{title}</b><em>{type}</em></span>{at===0?<Clock3 size={13}/>:<Check size={13}/>}</div>)}</div></div><div className="tm-homebar"/></div></div></div></section>;
}
