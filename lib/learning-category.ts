// The existing subject relationship is authoritative; no duplicate category column.
export function learningCategory(kind:string,subjectId?:string|null){return ['corporate','edtech'].includes(kind)?'training':subjectId?'academic':'non_credit'}
export function learningCategoryError(kind:string,type:string|undefined,subjectId:string){
 if(['corporate','edtech'].includes(kind))return subjectId||type&&type!=='training'?'Provider and corporate learning use training courses without curriculum subjects.':'';
 if(type==='training')return 'Choose Academic subject or Non-credit course for this institution.';
 if(type==='academic'&&!subjectId)return 'Select a curriculum subject for academic learning.';
 if(type==='non_credit'&&subjectId)return 'Non-credit courses must not have a curriculum subject link.';
 return '';
}
