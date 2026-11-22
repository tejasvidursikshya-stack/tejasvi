import type {CalendarEvent} from './calendar-policy';
export function onDay(e:CalendarEvent,day:Date){const next=new Date(day);next.setDate(next.getDate()+1);return Date.parse(e.start)<next.getTime()&&(Date.parse(e.end)>day.getTime()||Date.parse(e.start)>=day.getTime())}
export function isDeadline(e:CalendarEvent){return e.kind==='deadline'||e.kind==='revision'}
export function minutes(d:Date){return d.getHours()*60+d.getMinutes()+d.getSeconds()/60}
export function daySegment(e:CalendarEvent,day:Date){const next=new Date(day);next.setDate(next.getDate()+1);return {start:Date.parse(e.start)<day.getTime()?0:minutes(new Date(e.start)),end:Date.parse(e.end)>=next.getTime()?1440:minutes(new Date(e.end))}}
// Position simultaneous classes in separate lanes, including minimum-height cards.
export function placeEvents(events:CalendarEvent[],day:Date){const sorted=events.filter(e=>!isDeadline(e)&&onDay(e,day)).map(e=>({event:e,...daySegment(e,day),lane:0,lanes:1})).sort((a,b)=>a.start-b.start||a.end-b.end);let group:typeof sorted=[],ends:number[]=[],until=-1;
 const finish=()=>{for(const item of group)item.lanes=ends.length;group=[];ends=[]};
 for(const item of sorted){if(item.start>=until){finish();until=-1}let lane=ends.findIndex(end=>end<=item.start);if(lane<0)lane=ends.length;item.lane=lane;ends[lane]=Math.max(item.end,item.start+30);until=Math.max(until,ends[lane]);group.push(item)}finish();return sorted}
export function hourRange(events:CalendarEvent[],days:Date[]){let first=8,last=18;for(const day of days)for(const e of events){if(isDeadline(e)||!onDay(e,day))continue;const s=daySegment(e,day);first=Math.min(first,Math.floor(s.start/60));last=Math.max(last,Math.ceil(Math.max(s.end,s.start+30)/60))}return {first:Math.max(0,first),last:Math.min(24,last)}}
