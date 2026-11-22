import {z} from 'zod';
import {identity,respond,failure} from '@/lib/platform-server';
import {coursePermission} from '@/lib/course-access';
import {rows} from '@/lib/db';
import {studioPayload} from '@/lib/studio';
import {hasMaterials,kitForLearners} from '@/lib/atelier';
export async function GET(req:Request){try{const user=await identity(),id=z.string().uuid().parse(new URL(req.url).searchParams.get('course')),course=await coursePermission(id,user.userId);if(course.status!=='published')return respond({sets:[],films:[],flashcards:[]});
 const list=await rows('SELECT id,payload FROM ai_studio_drafts WHERE org_id=? AND imported_course_id=? AND resources_shared_at IS NOT NULL ORDER BY resources_shared_at DESC LIMIT 30',[course.org_id,id]);
 const films=await rows('SELECT id,title FROM ai_course_films WHERE org_id=? AND course_id=? ORDER BY created_at DESC',[course.org_id,id]);const flashcards=await rows('SELECT deck_id AS id,title,JSON_LENGTH(cards_json) AS size FROM tutoring_course_decks WHERE course_id=? ORDER BY shared_at DESC,deck_id',[id]);return respond({orgId:course.org_id,films,flashcards,sets:list.flatMap(row=>{const d=studioPayload.safeParse(typeof row.payload==='string'?JSON.parse(row.payload):row.payload);if(!d.success||!d.data.kit||!hasMaterials(d.data.kit))return [];return [{id:row.id,title:d.data.title,resources:kitForLearners(d.data.kit)}];})});}catch(e){return failure(e)}}

