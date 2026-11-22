import type {Course,Progress,Quiz,Question} from './platform-types';
export type LearningModule={id:string;title:string;position:number;duration:number;objectives:string;content:string;quiz:Question[];quizRevision:string;completed:boolean};
export type OutlineStep={id:string;title:string;group:string;type:'reading'|'resources'|'quiz'|'assignments'|'lesson'|'final';unitId?:string;lessonId?:string;done:boolean;tracked:boolean};
export function corporateOutline(course:Course,units:LearningModule[],progress?:Progress,quiz?:Quiz):OutlineStep[]{
 const steps:OutlineStep[]=[];
 for(const u of units){const group=`${u.position}. ${u.title}`;steps.push({id:u.id+':reading',title:'Learning & objectives',group,type:'reading',unitId:u.id,done:u.completed,tracked:true},{id:u.id+':resources',title:'Resources',group,type:'resources',unitId:u.id,done:false,tracked:false});if(u.quiz.length)steps.push({id:u.id+':quiz',title:'Knowledge check',group,type:'quiz',unitId:u.id,done:!!progress?.unitQuizPassed?.includes(u.id),tracked:true});steps.push({id:u.id+':assignments',title:'Assignments & projects',group,type:'assignments',unitId:u.id,done:false,tracked:false});}
 for(const l of course.lessons)steps.push({id:l.id,title:l.title,group:'Additional lessons',type:'lesson',lessonId:l.id,done:!!progress?.lessons.includes(l.id),tracked:true});
 if(quiz)steps.push({id:'final:'+quiz.id,title:quiz.title,group:'Final knowledge check',type:'final',done:progress?.quizRevision===quiz.id+':'+quiz.updatedAt&&(progress?.score??0)>=70,tracked:true});
 return steps;
}
export function resumeStep(steps:OutlineStep[]){return steps.find(s=>s.tracked&&!s.done)?.id||steps[0]?.id||'';}
