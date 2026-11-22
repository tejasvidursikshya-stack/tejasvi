import React,{useId,useMemo,useRef,useState} from 'react';
import {Activity,ArrowDownUp,ArrowLeft,ArrowRight,ArrowUpRight,BookOpen,CalendarDays,ChartNoAxesColumn,ChevronLeft,ChevronRight,CircleCheck,ClipboardList,Clock,GraduationCap,Layers,Receipt,ShieldCheck,Wallet} from 'lucide-react';
import {dashboardModel,markInitials} from './material-model.mjs';
import {number,amount} from './dashboard-model.mjs';
const palette=['#3478e7','#182c45','#e19243','#8163b5','#6393b7','#a9758d','#87929f'];
const icons={application:GraduationCap,invoice:Receipt,result:BookOpen,action:ClipboardList,schedule:CalendarDays};
function describe(ctx,role){
 const school=ctx.profile.kind==='school';
 if(role==='Student')return ['Your learning at a glance','Find your next class, check your attendance and review published results.'];
 if(role==='Faculty')return ['Your teaching at a glance','Review your teaching schedule, class attendance and assessment records.'];
 if(role==='Finance Head')return ['Your finance overview','Review receipts, outstanding invoices and expenditure for the selected year.'];
 if(ctx.allAccess)return [school?'Your school at a glance':'Your campus at a glance','Follow enrollment, attendance and the work that needs your attention.'];
 return ['Your workspace at a glance','Check the latest figures and open the registers available to your role.'];
}
export function MiniChart({tile,go}){
 const initial=tile.points.reduce((p,b,i)=>b.observed?i:p,-1),[hot,setHot]=useState(null),[tab,setTab]=useState(Math.max(0,initial)),refs=useRef([]);
 const max=tile.zeroTo||Math.max(1,...tile.points.map(b=>b.value||0)),idx=hot??initial,p=tile.points[hot];
 const move=(e,i)=>{const n=tile.points.length;let next;if(e.key==='ArrowLeft')next=(i+n-1)%n;else if(e.key==='ArrowRight')next=(i+1)%n;else if(e.key==='Home')next=0;else if(e.key==='End')next=n-1;else return;e.preventDefault();setTab(next);refs.current[next]?.focus();};
 return <article className="md-card md-mini"><div className="md-card-pad"><h2>{tile.title}</h2><p className="md-caption">{tile.sub}</p><strong className="md-figure">{tile.value}</strong>
 {tile.any&&tile.points.length>0?<div className="md-barset" role="group" aria-label={tile.title+' chart. Use left and right arrow keys to explore.'} style={{'--bars':tile.points.length}} onMouseLeave={()=>setHot(null)}>
 {tile.points.map((b,i)=><button key={b.full} ref={el=>{refs.current[i]=el}} type="button" tabIndex={i===tab?0:-1} onMouseEnter={()=>setHot(i)} onFocus={()=>{setHot(i);setTab(i)}} onBlur={()=>setHot(null)} onClick={()=>{setHot(i);setTab(i)}} onKeyDown={e=>move(e,i)} className={i===idx?'is-current':''} aria-label={b.full+': '+(b.value===null?'No attendance marked':tile.display(b.value))}><span className="md-bar-track"><i style={{height:(b.value==null||b.value===0?'0':Math.max(4,Math.min(100,b.value/max*100))+'%')}}/></span><small>{tile.categorical?b.label.slice(0,3):b.label}</small></button>)}</div>:
 <div className="md-chart-empty"><ChartNoAxesColumn size={20}/><span>{tile.any?'Register total shown above.':'No records in this period.'}</span></div>}
 <div className="md-period" aria-live="off">{p?p.full+' · '+(p.value==null?'No marks':tile.display(p.value)):tile.range}</div></div>
 <button className="md-footlink" onClick={()=>go(tile.entity)}><span><i/>{tile.open}</span><ArrowUpRight size={14}/></button></article>;
}
function Attention({box,ctx}){
 const [all,setAll]=useState(false);const open=x=>x.record?ctx.setDrawer({entity:x.entity,record:x.record}):ctx.go(x.entity);
 return <article className="md-card md-attention"><div className="md-card-pad"><h2>{box.title}</h2><p className="md-caption">{box.icon==='schedule'?'From your timetable':'Items to follow up'}</p>
 {box.items.length?<div className="md-events">{box.items.slice(0,all?undefined:2).map((v,i)=>{const Icon=icons[v.icon||box.icon]||Activity;return <button key={(v.record?.id||v.entity)+'-'+i} onClick={()=>open(v)}><span className={'md-event-icon e'+i%3}><Icon size={15}/></span><span><b>{v.title}</b><small>{v.note}</small></span></button>})}</div>:<div className="md-clear"><CircleCheck size={20}/><span>{box.empty}</span></div>}</div>
 {box.link?<button className="md-footlink" onClick={()=>ctx.go(box.link)}><span>{box.footer}</span><ArrowUpRight size={14}/></button>:box.items.length>2?<button className="md-footlink" onClick={()=>setAll(!all)} aria-expanded={all}><span>{all?'Show fewer items':'See all '+box.items.length+' areas'}</span><ChevronRight size={14}/></button>:<div className="md-badge-foot"><span>{box.items.length?'For your role':'Up to date'}</span></div>}</article>;
}
function RegisterTable({table,ctx}){
 const [order,setOrder]=useState('default'),[page,setPage]=useState(0),id=useId(),sorted=useMemo(()=>[...table.all].sort((a,b)=>(order==='default'?b.rank-a.rank:0)||String(a.name).localeCompare(String(b.name))),[table,order]);
 const last=Math.max(0,Math.ceil(sorted.length/5)-1),index=Math.min(page,last),visible=sorted.slice(index*5,index*5+5);
 const open=v=>v.record?ctx.setDrawer({entity:table.entity,record:v.record}):ctx.go(v.entity);
 return <section className="md-card md-table" aria-labelledby={id}><header className="md-block-head"><div><h2 id={id}>{table.title}</h2><p><i className="md-blue-dot"/>{table.desc}</p></div><div className="md-table-tools">{table.all.length>1&&<label className="md-sort"><ArrowDownUp size={14}/><select aria-label={'Sort '+table.title} value={order} onChange={e=>{setOrder(e.target.value);setPage(0)}}><option value="default">{table.mode==='programs'?'Most students':table.mode==='fees'?'Highest balance':table.mode==='registers'?'Most records':'Default order'}</option><option value="name">Name A–Z</option></select></label>}{table.entity&&<button className="md-link" onClick={()=>ctx.go(table.entity)}>{table.link}<ArrowUpRight size={15}/></button>}</div></header>
 {sorted.length?<><div className="md-table-wrap"><table><thead><tr>{table.columns.map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{visible.map((r,i)=><tr key={r.id}><th scope="row"><button onClick={()=>open(r)}><i className={'md-monogram tone'+((index*5+i)%5)} aria-hidden="true">{(r.badge||markInitials(r.name)).slice(0,4)}</i><span><b>{r.name}</b>{r.code&&<small>{r.code}</small>}</span></button></th>{r.cells.map((c,j)=><td key={j} data-label={table.columns[j+1]}><span className={'md-cell '+(c.meter!==undefined?'has-meter':'')}>{c.main}{c.meter!=null&&<i aria-hidden="true"><b style={{width:Math.max(0,Math.min(100,c.meter))+'%'}}/></i>}</span></td>)}</tr>)}</tbody></table></div>
 {last>0&&<div className="md-pager"><span aria-live="polite">Showing {index*5+1}–{Math.min(index*5+5,sorted.length)} of {number(sorted.length)}</span><button aria-label="Previous table page" disabled={!index} onClick={()=>setPage(index-1)}><ChevronLeft size={17}/></button><button aria-label="Next table page" disabled={index===last} onClick={()=>setPage(index+1)}><ChevronRight size={17}/></button></div>}</>:
 <div className="md-empty-table"><Layers size={22}/><b>{table.mode==='programs'?'No programs recorded':table.mode==='courses'?'No courses assigned':table.mode==='fees'?'No invoices recorded':'No registers available'}</b><p>{table.mode==='courses'?'Courses appear here when your institution assigns them.':'This table fills from your institution’s records.'}</p></div>}</section>;
}
function Values({columns,rows}){
 return <details className="md-values"><summary>Chart values</summary><div><table><thead><tr>{columns.map(c=><th key={c} scope="col">{c}</th>)}</tr></thead><tbody>{rows.map(([first,...rest],i)=><tr key={i}><th scope="row">{first}</th>{rest.map((x,j)=><td key={j}>{x}</td>)}</tr>)}</tbody></table></div></details>;
}
function LinePlot({panel}){
 const id=useId().replaceAll(':',''),points=panel.points,top=Math.max(1,...points.flatMap(p=>[p.income,p.expense])),w=460,h=156,x=i=>48+(w-66)*i/Math.max(1,points.length-1),y=v=>12+(h-41)*(1-v/top);
 const line=key=>points.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+','+y(p[key]).toFixed(1)).join(' '),mini=v=>v>=1e6?number(v/1e6)+'m':v>=1000?number(v/1000)+'k':number(v);
 return <><svg viewBox={'0 0 '+w+' '+h} className="md-lineplot" role="img" aria-label={panel.title+'. Exact amounts are available under Chart values.'}><defs><linearGradient id={'ink'+id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#3478e7" stopOpacity=".23"/><stop offset="1" stopColor="#3478e7" stopOpacity=".025"/></linearGradient></defs>{[0,.5,1].map(f=><g key={f}><line x1={48} x2={w-18} y1={y(f*top)} y2={y(f*top)} stroke="#dce2e8" strokeDasharray="3 4"/><text x={40} y={y(f*top)+4} textAnchor="end">{mini(f*top)}</text></g>)}<path d={line('income')+' L '+x(points.length-1)+' '+y(0)+' L '+x(0)+' '+y(0)+' Z'} fill={'url(#ink'+id+')'}/>
 {['income','expense'].map((k,j)=><g key={k}><path d={line(k)} fill="none" stroke={j?'#182c45':'#3478e7'} strokeWidth="2.6" strokeLinejoin="round"/>{points.map((p,i)=><circle key={p.key} cx={x(i)} cy={y(p[k])} r="3.1" fill={j?'#182c45':'#3478e7'}><title>{p.label} · {k}: {amount(p[k])}</title></circle>)}</g>)}
 {points.map((p,i)=><text key={p.key} x={x(i)} y={h-6} textAnchor="middle">{p.label.split(' ')[0]}</text>)}</svg><div className="md-legend"><span><i style={{background:palette[0]}}/>Income</span><span><i style={{background:palette[1]}}/>Expenditure</span></div>
 <Values columns={['Month','Income','Expenditure']} rows={points.map(p=>[p.label,amount(p.income),amount(p.expense)])}/></>;
}
function CategoryPlot({panel}){
 const groups=panel.groups;let at=0;return panel.type==='ring'?<div className="md-ringrow"><div className="md-ring" aria-hidden="true" style={{background:'conic-gradient('+groups.map(([,v],i)=>{const start=at;at+=v/panel.total*100;return palette[i%palette.length]+' '+start+'% '+at+'%'}).join(',')+')'}}><span><b>{number(panel.total)}</b><small>marks</small></span></div><ul className="md-ring-legend">{groups.map(([label,v],i)=><li key={label}><i style={{background:palette[i%palette.length]}}/><span>{label}</span><b>{number(v)}</b></li>)}</ul></div>:
 <div className="md-status-bars">{groups.map(([label,v],i)=><div key={label}><span>{label}<b>{number(v)}</b></span><i><b style={{width:100*v/Math.max(1,...groups.map(g=>g[1]))+'%',background:palette[i%palette.length]}}/></i></div>)}</div>;
}
function Panel({panel,go}){const has=panel.type==='lines'?panel.any:panel.total>0;return <section className="md-card md-plot-card"><header className="md-block-head"><div><h2>{panel.title}</h2><p>{panel.description}</p></div><button aria-label={'Open register for '+panel.title} title="Open register" className="md-icon-btn" onClick={()=>go(panel.entity)}><ArrowUpRight size={17}/></button></header>{has?(panel.type==='lines'?<LinePlot panel={panel}/>:<CategoryPlot panel={panel}/>):<div className="md-panel-empty"><ChartNoAxesColumn size={24}/><span>No records to chart for this period.</span></div>}</section>;}
export default function MaterialOverview({ctx,tasks,details}){
 const sampleDate=ctx.data.demo?.enabled&&/^\d{4}-\d{2}-\d{2}$/.test(ctx.data.demo?.asOf||'')?ctx.data.demo.asOf:null;
 const model=useMemo(()=>dashboardModel(ctx,sampleDate?new Date(sampleDate+'T06:00:00Z'):new Date()),[ctx.records,ctx.year,ctx.user.role,ctx.profile.year,sampleDate]),[title,desc]=describe(ctx,model.role),action=tasks[0],secondary=tasks.slice(1);
 return <div className="md-overview"><header className="md-hero"><div className="md-hero-art" aria-hidden="true"/><div className="md-hero-copy"><p className="md-kicker"><span/>{ctx.profile.name} <i aria-hidden="true">·</i> {model.role}</p><h1>{title}</h1><p className="md-hero-desc">{desc}</p>{action&&<button onClick={action[4]}>{action[1]}<ArrowRight size={15}/></button>}</div></header>
 <div className="md-overview-row" style={{'--tiles':model.tiles.length+1}}>{model.tiles.map(t=><MiniChart key={ctx.year+t.entity} tile={t} go={ctx.go}/>)}<Attention key={ctx.year+model.role} box={model.attention} ctx={ctx}/></div>
 <RegisterTable key={ctx.year+model.table.mode} table={model.table} ctx={ctx}/>
 {model.panels.length>0&&<div className="md-plots">{model.panels.map(p=><Panel key={p.title} panel={p} go={ctx.go}/>)}</div>}
 <nav className="md-bottom-links" aria-label="More dashboard actions"><strong>More actions</strong>{secondary.map(a=><button key={a[0]} onClick={a[4]}>{a[1]}<ArrowUpRight size={15}/></button>)}<button onClick={details}>{model.role==='Student'?'My records':'Reports & details'}<ArrowRight size={15}/></button></nav></div>;
}
