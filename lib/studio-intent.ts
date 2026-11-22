import {validTool,validOutput,defaultOutput} from './atelier';
export function studioIntent(t:unknown,f:unknown){if(!validTool(t))return null;const output=validOutput(f)?f:defaultOutput[t];return {tool:t,output,query:'?studio='+t+'&output='+output};}
export function studioAfterLogin(normal:string,search:string){const q=new URLSearchParams(search),i=studioIntent(q.get('studio'),q.get('output'));return !i?normal:normal==='/change-password'?normal+i.query:'/workspaces'+i.query;}
