export function mayReadMaterial(role:string,visibility:string){return visibility==='learners'||role==='admin'||role==='teacher'}
export function effectiveMaterialVisibility(type:string,visibility:string){return type==='facilitation'?'teachers':visibility}
