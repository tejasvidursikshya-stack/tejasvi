import {ArrowRight,BookOpen,CalendarDays,ClipboardCheck,Layers,UsersRound,Wallet} from 'lucide-react';
export type DeskMetric={label:string;value:string;note:string;icon:'people'|'courses'|'balance'|'checks'|'calendar'|'units'};
const icons={people:UsersRound,courses:BookOpen,balance:Wallet,checks:ClipboardCheck,calendar:CalendarDays,units:Layers};
export function Desk({title,kicker,metrics,actions}:{title:string;kicker:string;metrics:DeskMetric[];actions:{label:string;run:()=>void}[]}){
 return <div className="ax-desk"><p className="ax-overline">{kicker}</p><h3>{title}</h3><div className="ax-quick">{actions.map(a=><button type="button" key={a.label} onClick={a.run}>{a.label}<ArrowRight size={13}/></button>)}</div><div className="ax-metrics">{metrics.map(m=>{const Icon=icons[m.icon];return <div key={m.label}><span><Icon size={15}/>{m.label}</span><strong>{m.value}</strong><small>{m.note}</small></div>})}</div></div>;
}
