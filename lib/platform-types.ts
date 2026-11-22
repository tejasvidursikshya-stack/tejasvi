export const roles = {
 "edtech-admin": {title:"EdTech administrator",kind:"edtech",role:"admin",description:"Learning beyond the classroom.",detail:"Manage partner schools, individual learners and teaching teams."},
 "edtech-teacher": {title:"EdTech teacher",kind:"edtech",role:"teacher",description:"Bring ideas to life.",detail:"Teach your assigned batches and publish learner results."},
 "edtech-student": {title:"EdTech learner",kind:"edtech",role:"student",description:"Build. Code. Discover.",detail:"Explore coding, robotics and AI with your learning team."},
  "school-admin": { title: "School admin", kind: "school", role: "admin", description: "Your school, connected.", detail: "Manage teachers, courses and classroom learning from one place." },
  teacher: { title: "Teacher", kind: "school", role: "teacher", description: "More time for teaching.", detail: "Plan your lessons, build engaging courses and check understanding with quizzes." },
  "corporate-admin": { title: "Corporate admin", kind: "corporate", role: "admin", description: "Build a stronger team.", detail: "Create training, give employees access and follow their learning progress." },
  student: { title: "Student", kind: "school", role: "student", description: "Discover something new.", detail: "Explore your school courses, complete lessons and practice what you learn with quizzes." },
  employee: { title: "Employee", kind: "corporate", role: "employee", description: "Make your next move.", detail: "Learn at your own pace, pick up new skills and keep your progress in one place." },
  "college-admin": { title: "College admin", kind: "college", role: "admin", description: "Your campus, connected.", detail: "Manage departments, semesters, batches and learning." },
  "college-teacher": { title: "College teacher", kind: "college", role: "teacher", description: "Teach with clarity.", detail: "Create learning materials and assess your assigned classes." },
  "college-student": { title: "College student", kind: "college", role: "student", description: "Your campus learning space.", detail: "Access your subjects, courses, projects and assessments." },
} as const;
export type RoleKey = keyof typeof roles;
export type Lesson = { format?:'text'|'video'|'audio'|'live';duration?:number; id: string; title: string; content: string; videoUrl: string };
export type Question = { id: string; prompt: string; options: string[]; correct?: number };
export type Course = { unitIds?:string[];unitQuizIds?:string[]; accessMode?:string; subjectId?:string; materials?:{id:string;name:string;kind:string}[]; id: string; title: string; description: string; audience: string; status: string; lessons: Lesson[]; quizId: string; author: string; updatedAt: string };
export type Quiz = { id: string; title: string; questions: Question[]; author: string; updatedAt: string };
export type Plan = { id: string; title: string; subject: string; grade: string; lessonDate: string; objectives: string; fileName: string; fileSize: number; author: string; updatedAt: string };
export type Progress = { units?:string[];unitQuizPassed?:string[]; courseId: string; email: string; lessons: string[]; score: number | null; quizRevision: string | null };
export type Organization = import('./brand-theme').Brand & { id: string; name: string; kind: string; role: string; address?: string; contactEmail?: string; phone?: string; registrationNumber?: string };
export type PlatformData = { sharedStudents?:{year:string;total:number;pending:number}|null; user: { userId: string; email: string; displayName: string; platformAdmin: boolean }; workspaces?: {id:string;name:string;kind:string;role:string}[]; organizations: Organization[]; organization: Organization | null; courses: Course[]; quizzes: Quiz[]; plans: Plan[]; members: { email: string; role: string; name: string; userId: string; className: string; referenceNumber: string }[]; progress: Progress[] };
