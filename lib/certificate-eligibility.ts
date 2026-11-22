import {one,rows,type DB} from './db';
// All decisions use current server records, never a percentage supplied by a learner.
export async function certificateEligibility(course:{id:string;quiz_id?:string},userId:string,requireAssessments:boolean,db?:DB){
 const lessons=await rows('SELECT l.id,lc.lesson_id AS done FROM lessons l LEFT JOIN lesson_completions lc ON lc.lesson_id=l.id AND lc.user_id=? WHERE l.course_id=?',[userId,course.id],db);
 const units=await rows("SELECT u.id,u.quiz_revision,JSON_LENGTH(u.quiz) AS questions,uc.unit_id AS done FROM course_units u LEFT JOIN unit_completions uc ON uc.unit_id=u.id AND uc.user_id=? WHERE u.course_id=? AND u.status='published'",[userId,course.id],db);
 const reasons:string[]=[];if(!lessons.length&&!units.length)reasons.push('The course has no published learning content.');
 if(lessons.some(l=>!l.done)||units.some(u=>!u.done))reasons.push('Complete every lesson and published module reading.');
 if(course.quiz_id){const q=await one('SELECT revision FROM quizzes WHERE id=?',[course.quiz_id],db);const a=q?await one('SELECT score FROM quiz_attempts WHERE course_id=? AND user_id=? AND quiz_id=? AND quiz_revision=? ORDER BY submitted_at DESC,id DESC LIMIT 1',[course.id,userId,course.quiz_id,q.revision],db):null;if(!a||a.score<70)reasons.push('Pass the current final quiz with at least 70%.');}
 for(const u of units.filter(u=>u.questions>0)){const a=await one('SELECT score FROM unit_quiz_attempts WHERE unit_id=? AND user_id=? AND quiz_revision=? ORDER BY submitted_at DESC,id DESC LIMIT 1',[u.id,userId,u.quiz_revision],db);if(!a||a.score<70){reasons.push('Pass every current module quiz with at least 70%.');break;}}
 if(requireAssessments){const assessments=await rows("SELECT a.id,a.max_score,s.score FROM assessments a LEFT JOIN course_units u ON u.id=a.unit_id LEFT JOIN submissions s ON s.assessment_id=a.id AND s.user_id=? WHERE a.course_id=? AND a.status='published' AND (a.unit_id IS NULL OR u.status='published')",[userId,course.id],db);if(assessments.some(a=>a.score===null||a.score===undefined||a.score/a.max_score<.7))reasons.push('Receive a grade of at least 70% on every published assignment and project.');}
 return {eligible:reasons.length===0,reasons};
}
