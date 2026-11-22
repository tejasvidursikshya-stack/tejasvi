export function paymentError(value:string,balance:number){
 if(!/^\d+(?:\.\d{1,2})?$/.test(value.trim()))return 'Enter a valid amount with up to two decimal places.';
 const amount=Number(value);
 return amount<=0?'Enter an amount greater than zero.':amount>balance?'The payment cannot exceed the outstanding balance.':'';
}
export function resultError(value:string){return !/^\d+(?:\.\d{1,2})?$/.test(value.trim())||Number(value)>100?'Enter a mark between 0 and 100.':'';}
export function canComplete(lessons:number,completed:number,quizPassed:boolean,assignmentGraded:boolean){return lessons>0&&completed>=lessons&&quizPassed&&assignmentGraded;}
