'use client';

import {ArrowUpRight, BookOpen, CalendarDays, Check, CheckCheck, ClipboardCheck, Code2, ChevronDown, FileText, Lightbulb, Play, Sparkles, Video} from 'lucide-react';
import {MotionSection} from './home-motion';
import '@/app/home-cinematic.css';

export function LearningAtmosphere({dark = false}: {dark?: boolean}) {
  return <div className={'jc-atmosphere' + (dark ? ' jc-atmosphere-dark' : '')} aria-hidden="true">
    <span className="jc-glow jc-glow-one"/>
    <span className="jc-glow jc-glow-two"/>
    <svg className="jc-orbit-lines" viewBox="0 0 1000 650" fill="none" preserveAspectRatio="xMidYMid slice">
      <ellipse cx="690" cy="355" rx="360" ry="245" transform="rotate(-22 690 355)"/>
      <ellipse cx="690" cy="355" rx="300" ry="198" transform="rotate(-22 690 355)"/>
      <circle cx="418" cy="204" r="5"/>
      <circle cx="886" cy="503" r="8"/>
    </svg>
    <span className="jc-float jc-float-one"><Code2 size={26} strokeWidth={1.2}/></span>
    <span className="jc-float jc-float-two"><Sparkles size={23} strokeWidth={1.2}/></span>
    <span className="jc-float jc-float-three"><Lightbulb size={23} strokeWidth={1.2}/></span>
  </div>;
}

function ResourcePreview() {
  return <div className="jc-art jc-resource-art" aria-hidden="true">
    <div className="jc-resource-sheet">
      <div className="jc-art-top"><span><span className="jc-status-dot"/> UNIT 01</span><BookOpen size={17}/></div>
      <strong>Java · Classes and objects</strong>
      <div className="jc-resource-line"><span className="jc-file-icon jc-icon-peach"><Play size={13}/></span><span>Lecture presentation</span><small>PPT</small></div>
      <div className="jc-resource-line"><span className="jc-file-icon jc-icon-blue"><FileText size={14}/></span><span>Practice worksheet</span><small>PDF</small></div>
      <div className="jc-resource-line"><span className="jc-file-icon jc-icon-mint"><ClipboardCheck size={14}/></span><span>Class activity</span><small>PDF</small></div>
    </div>
    <span className="jc-art-sticker"><Check size={12}/> Published to the class</span>
  </div>;
}

function FeedbackPreview() {
  return <div className="jc-art jc-feedback-art" aria-hidden="true">
    <div className="jc-feedback-sheet">
      <div className="jc-art-top"><span>PROJECT · REVIEWED</span><CheckCheck size={18}/></div>
      <div className="jc-feedback-score"><span>8<small>/10</small></span><div><strong>Assignment returned</strong><span>Marks and feedback available</span></div></div>
      <div className="jc-comment"><span className="jc-comment-avatar">T</span><div><strong>A note from your teacher</strong><span>“Good thinking. Try adding a real-world example.”</span></div></div>
    </div>
  </div>;
}

function SchedulePreview() {
  return <div className="jc-art jc-schedule-art" aria-hidden="true">
    <div className="jc-schedule-sheet">
      <div className="jc-art-top"><span>YOUR LEARNING WEEK</span><CalendarDays size={17}/></div>
      <div className="jc-week">{['M','T','W','T','F'].map((day, i) => <span key={i} className={i === 2 ? 'jc-day-active' : ''}>{day}<strong>{12+i}</strong></span>)}</div>
      <div className="jc-class"><span className="jc-video-icon"><Video size={19}/></span><div><strong>Java Programming</strong><span>09:00 – 09:45 · Online class</span></div><ArrowUpRight size={14}/></div>
    </div>
  </div>;
}

function StudioPreview() {
  return <div className="jc-art jc-studio-art" aria-hidden="true">
    <span className="jc-studio-star"><Sparkles size={31} strokeWidth={1.3}/></span>
    <div className="jc-studio-sheet"><span><Sparkles size={13}/> TEACHER DRAFT</span><strong>“Plan a lesson on<br/>classes and objects.”</strong><div><i/><i/><i/></div><small>Generate → Check → Edit</small></div>
  </div>;
}

export function LearningGallery({quiet}: {quiet: boolean}) {
  return <MotionSection quiet={quiet} className="jc-gallery" id="experience" aria-labelledby="jc-gallery-title">
    <LearningAtmosphere/>
    <div className="jy-wrap jc-gallery-inner">
      <header className="jc-gallery-heading jy-reveal">
        <div><p className="jy-eyebrow">THE TOOLS BEHIND EACH CLASS</p><h2 id="jc-gallery-title">Prepare. Teach.<br/><em>See the progress.</em></h2></div>
        <div><p>Keep the material, the task and the feedback connected. Open a card’s details to see how each tool works.</p></div>
      </header>
      <div className="jc-gallery-grid">
        <article className="jc-card jc-photo-card jy-reveal" aria-labelledby="jc-community-title">
          <img src="/assets/joy/learning-together.webp" srcSet="/assets/joy/learning-together-small.webp 600w, /assets/joy/learning-together.webp 1000w" sizes="(max-width: 600px) 92vw, (max-width: 1000px) 88vw, 34vw" width={1000} height={1500} loading="lazy" decoding="async" alt="Illustrative college students using shared lesson materials during a robotics project"/>
          <span className="jc-photo-shade"/>
          <span className="jc-photo-label"><Sparkles size={14}/> THE PUBLISHING WORKFLOW</span>
          <div className="jc-photo-copy"><span>FROM TEACHER TO LEARNER</span><h3 id="jc-community-title">Publish once.<br/>Reach your class.</h3>
            <ol className="hc-publish-steps"><li><strong>Prepare the unit</strong><span>Add lesson text, slides and practice files.</span></li><li><strong>Check the audience</strong><span>Confirm subject, course or batch access.</span></li><li><strong>Publish the content</strong><span>Enrolled learners see it in their workspace.</span></li></ol>
          </div>
        </article>
        <article className="jc-card jc-card-mint jy-reveal" aria-labelledby="jc-content-title">
          <ResourcePreview/>
          <div className="jc-card-copy"><span>LESSON MATERIALS</span><h3 id="jc-content-title">A place for<br/>every resource.</h3><p>Separate lecture slides, worksheets and activities within the relevant unit.</p>
            <details className="hc-tool-detail"><summary>How resources are organized <ChevronDown size={16}/></summary><p>Teachers add lesson text, upload PDF or presentation files and include reference links. Learners find each item under its material type, with a preview or download where supported.</p></details>
          </div>
        </article>
        <article className="jc-card jc-card-lilac jy-reveal" aria-labelledby="jc-feedback-title">
          <FeedbackPreview/>
          <div className="jc-card-copy"><span>ASSIGNMENTS & GRADING</span><h3 id="jc-feedback-title">From question<br/>to feedback.</h3><p>Keep instructions, deadlines, submissions and returned marks together.</p>
            <details className="hc-tool-detail"><summary>Follow an assignment <ChevronDown size={16}/></summary><p>Upload the question and its attachments, set the deadline, then publish to the class. Students submit their work; teachers review it, enter marks and return feedback in the same workflow.</p></details>
          </div>
        </article>
        <article className="jc-card jc-card-peach jy-reveal" aria-labelledby="jc-schedule-title">
          <SchedulePreview/>
          <div className="jc-card-copy"><span>TIMETABLE & LIVE CLASSES</span><h3 id="jc-schedule-title">Know what’s on.<br/>Know where to go.</h3><p>Bring class times, meeting links and assessment deadlines into the schedule.</p>
            <details className="hc-tool-detail"><summary>See how classes connect <ChevronDown size={16}/></summary><p>Add the subject, teacher, batch and time to a class event. For online sessions, attach your meeting provider’s link so learners can open it from their timetable.</p></details>
          </div>
        </article>
        <article className="jc-card jc-card-blue jy-reveal" aria-labelledby="jc-studio-title">
          <StudioPreview/>
          <div className="jc-card-copy"><span>AI STUDIO</span><h3 id="jc-studio-title">A first draft.<br/>Your expertise.</h3><p>Start lesson and assessment drafts, then shape them for the learners you know.</p>
            <details className="hc-tool-detail"><summary>What the educator controls <ChevronDown size={16}/></summary><p>Choose the topic and level, generate a starting point, then check and edit the result before publishing. Your organization must configure its AI provider to enable generation.</p></details>
          </div>
        </article>
      </div>
      <div className="jc-gallery-foot"><span>Illustrative previews with fictional lesson content and marks.</span><span>Each tool is available according to the user’s role and access.</span></div>
    </div>
  </MotionSection>;
}

const launchSteps = [
  ['Set up your organization', 'Choose its institution type and add the name, logo and colors.'],
  ['Build the structure', 'Create academic subjects and batches, or the courses and groups for a training program.'],
  ['Add your people', 'Create teachers, import learners with the CSV template and check their assignments.'],
  ['Run a first class', 'Publish one unit, verify it with a learner account and collect feedback before expanding.'],
];

export function LaunchGuide({quiet}: {quiet: boolean}) {
  return <MotionSection quiet={quiet} className="hc-launch" id="getting-started" aria-labelledby="hc-launch-title">
    <div className="jy-wrap hc-launch-grid">
      <div className="hc-launch-photo">
        <img src="/assets/joy/next-chapter.webp" srcSet="/assets/joy/next-chapter-small.webp 720w, /assets/joy/next-chapter.webp 1600w" sizes="(max-width: 800px) 90vw, 45vw" width={1600} height={900} loading="lazy" decoding="async" alt="Illustrative college students arriving on campus with books and a tablet"/>
        <span>START WITH ONE CLASS. BUILD FROM THERE.</span>
      </div>
      <div className="hc-launch-copy"><p className="jy-eyebrow">GETTING STARTED</p><h2 id="hc-launch-title">A manageable<br/><em>first rollout.</em></h2><p>Give your administrator a clear order of work, from an empty workspace to the first published lesson.</p>
        <ol>{launchSteps.map(([title, body], i) => <li key={title}><span>0{i+1}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol>
        <a className="jy-text-link" href="#questions">Read the setup answers <ArrowUpRight size={17}/></a>
      </div>
    </div>
  </MotionSection>;
}
