export function learningToolsKey(org:string,section:string,course:string,revision:number){return JSON.stringify([org,section,course,revision])}
export function readLearningToolsResponse(section:string,value:unknown):any {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Unexpected learning tools response. Refresh and try again.');
 const d=value as Record<string,unknown>;
 const arrays:Record<string,string[]>={discussions:['courses','items'],sessions:['courses','items'],catalog:['offers','orders','courses','available'],policies:['policies','acknowledgements','audit'],reports:['report'],ai:[]};
 if(!Object.hasOwn(arrays,section)||typeof d.role!=='string'||arrays[section].some(k=>!Array.isArray(d[k]))||(section==='ai'&&typeof d.enabled!=='boolean'))throw new Error('The server returned incomplete learning tools data. Refresh and try again.');
 if(['discussions','sessions'].includes(section)&&d.course!==null&&(!d.course||typeof d.course!=='object'||typeof (d.course as any).id!=='string'))throw new Error('The server returned an invalid course selection. Refresh and try again.');
 return d;
}
