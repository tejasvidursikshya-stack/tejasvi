import {z} from 'zod';
export const examComponents=z.array(z.object({label:z.string().trim().min(1).max(80),max:z.number().int().min(1).max(1000)})).min(1).max(10).refine(a=>new Set(a.map(x=>x.label.toLowerCase())).size===a.length,'Use distinct component names.');
export function validScores(components:{max:number}[],scores:number[],absent:boolean){return absent?scores.length===0:scores.length===components.length&&scores.every((v,i)=>Number.isFinite(v)&&v>=0&&v<=components[i].max&&Math.abs(Math.round(v*100)-v*100)<1e-7)}
export function resultSummary(components:{max:number}[],scores:number[],absent:boolean){const max=components.reduce((n,c)=>n+c.max,0),total=scores.reduce((n,v)=>n+v,0);return {max,total:Math.round(total*100)/100,percent:absent?null:Math.round(total/max*10000)/100}}
