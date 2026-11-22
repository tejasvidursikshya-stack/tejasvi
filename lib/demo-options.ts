export const demoAudiences=['college','school','corporate'] as const;
export type DemoAudience=typeof demoAudiences[number];
export const statuses=['new','contacted','closed'] as const;
export type RequestStatus=typeof statuses[number];
export const isAudience=(s:unknown):s is DemoAudience=>typeof s==='string'&&demoAudiences.some(a=>a===s);
export const isRequestStatus=(s:unknown):s is RequestStatus=>typeof s==='string'&&statuses.some(a=>a===s);
export const reference=(id:string)=>'TJ-'+id.replaceAll('-','').slice(0,10).toUpperCase();
