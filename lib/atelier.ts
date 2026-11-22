/** Shared contracts for the public exhibit, signed-in studio and resource reader. */
export const toolsList=['create','build','assist','plan'] as const;
export type StudioTool=typeof toolsList[number];
export const outputKeys=['modules','slides','quiz','video','worksheet','flashcards','storybook','summary','plan'] as const;
export type Output=typeof outputKeys[number];
export const primaryOutputs:Output[]=['modules','slides','quiz','video','worksheet','flashcards'];
export const outputNames:Record<Output,string>={modules:'Course modules',slides:'PPT slides',quiz:'Quiz',video:'Lesson video',worksheet:'Worksheet',flashcards:'Flashcards',storybook:'Storybook',summary:'Lecture notes',plan:'Lesson plan'};
export const toolsInfo:Record<StudioTool,{name:string;short:string;words:[string,string];color:string;copy:string;subtitle:string;actions:[string,Output][]}> = {
 create:{name:'AI Content Creation',short:'Create',words:['Content','atelier.'],color:'#ca8758',subtitle:'INK & AMBER  /  01',copy:'Teach an idea in more than one way. Shape a visual story, a practice question or an activity sheet from the same brief.',actions:[['Animated lesson video','video'],['Storybook pages','storybook'],['Smart quiz builder','quiz'],['Worksheet generator','worksheet']]},
 build:{name:'AI Course Builder',short:'Build',words:['Course','architect.'],color:'#859ac8',subtitle:'BLUEPRINT  /  02',copy:'Give a syllabus a clear sequence. Connect objectives, slides and checks for understanding before you open a course to learners.',actions:[['Structured modules','modules'],['Editable PowerPoint','slides'],['Curriculum objectives','plan'],['Reviewed course publishing','modules']]},
 assist:{name:'Lecture Assistant',short:'Assist',words:['Lecture','notebook.'],color:'#aa8cab',subtitle:'MIDNIGHT INK  /  03',copy:'Capture what mattered in class. Work from your own notes to prepare a recap, revision cards and a short knowledge check.',actions:[['Capture lecture notes','summary'],['Revision flashcards','flashcards'],['Follow-up quiz','quiz'],['Session summary','summary']]},
 plan:{name:'Lecture Planner',short:'Plan',words:['Lesson','rhythm.'],color:'#8db4bf',subtitle:'SKY GLASS  /  04',copy:'Budget the minutes before the first bell. Pair each activity with an objective and leave room to check what learners understood.',actions:[['Timed lesson plan','plan'],['Activity suggestions','worksheet'],['Time allocation','plan'],['Learning objectives','modules']]}
};
export const validTool=(s:unknown):s is StudioTool=>typeof s==='string'&&toolsList.includes(s as StudioTool);
export const validOutput=(s:unknown):s is Output=>typeof s==='string'&&outputKeys.includes(s as Output);
export const defaultOutput:Record<StudioTool,Output>={create:'slides',build:'modules',assist:'summary',plan:'plan'};
export type Pair={title:string;body:string};
export type ResourceKit={slides:Pair[];worksheet:Pair[];flashcards:Pair[];scenes:Pair[];notes:string;summary:string};
export type PublicKit=Pick<ResourceKit,'slides'|'worksheet'|'flashcards'|'scenes'>;
export const blankKit=():ResourceKit=>({slides:[],worksheet:[],flashcards:[],scenes:[],notes:'',summary:''});
export const kitForLearners=(k:ResourceKit):PublicKit=>({slides:k.slides,worksheet:k.worksheet,flashcards:k.flashcards,scenes:k.scenes});
export const hasMaterials=(k?:PublicKit)=>!!k&&[k.slides,k.worksheet,k.flashcards,k.scenes].some(v=>Array.isArray(v)&&v.length>0);
export const anatomy:Record<StudioTool,string>={create:'Create slides, a practice quiz, a student worksheet, flip cards and captioned visual story scenes.',build:'Sequence modules against the stated curriculum or objectives. Use an example, learner activity and check in each unit.',assist:'Treat the educator’s typed lecture notes as source. Produce a faithful recap, retrieval questions and short revision cards; do not claim to have recorded speech.',plan:'The sum of module durations must equal the requested minutes; give realistic activity timings, a clear measurable objective and an exit check.'};
