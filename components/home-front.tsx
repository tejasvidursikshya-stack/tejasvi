'use client';

import {useEffect, useRef, useState, type Dispatch, type SetStateAction} from 'react';
import {
  ArrowRight, ArrowUpRight, BookOpen, BriefcaseBusiness, Check,
  ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, GraduationCap,
  Menu, MessageSquare, Pause, Play, School, Sparkles, TrendingUp,
} from 'lucide-react';
import {Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger} from '@/components/ui/sheet';
import {DeviceShowcase} from '@/components/home-showcase';

const audiences = [
  {
    id: 'school', label: 'Schools', icon: School, tag: 'A CONNECTED SCHOOL DAY',
    title: 'More time to teach.\nRoom for every learner.',
    description: 'Bring your classes, teachers and learning materials together. Make each school day easier to organize and follow.',
    image: 'school', alt: 'Illustration of a teacher guiding school students through a tablet activity',
    structure: ['Grade', 'Section', 'Subject', 'Unit'],
    points: [
      ['Organize your classes', 'Set up grades, sections and subject batches.'],
      ['Connect teaching and learning', 'Share lessons, assignments and class schedules.'],
      ['Follow each learner', 'Review attendance, submissions and assessment results.'],
    ], cta: 'Open your school workspace',
  },
  {
    id: 'college', label: 'Colleges', icon: GraduationCap, tag: 'EVERY SEMESTER, IN FOCUS',
    title: 'A clearer view of\nyour whole campus.',
    description: 'Give faculties, teachers and students a shared academic workspace, organized around the way your college runs.',
    image: 'college', alt: 'Illustration of college students collaborating on a laptop',
    structure: ['Faculty', 'Semester', 'Subject', 'Unit'],
    points: [
      ['Build your academic structure', 'Connect faculties, semesters and subjects.'],
      ['Coordinate teaching', 'Assign teachers and enrol students in subject batches.'],
      ['Keep results together', 'Review internal marks, assessments and learning hours.'],
    ], cta: 'Open your college workspace',
  },
  {
    id: 'corporate', label: 'Corporate', icon: BriefcaseBusiness, tag: 'LEARNING THAT MOVES TEAMS FORWARD',
    title: 'Build skills.\nKeep your team moving.',
    description: 'Make onboarding and professional development part of everyday work, with focused training for every team.',
    image: 'corporate', alt: 'Illustration of colleagues collaborating during workplace training',
    structure: ['Training batch', 'Course', 'Module'],
    points: [
      ['Bring the right people together', 'Create training batches for teams or new joiners.'],
      ['Deliver focused programs', 'Assign courses, modules and assessments.'],
      ['Recognize completion', 'Track learning progress and issue course certificates.'],
    ], cta: 'Open your corporate workspace',
  },
] as const;
const navigation = [['Solutions', '#solutions'], ['Learning tools', '#tools'], ['Mobile access', '#on-your-screen'], ['Your brand', '#branding']] as const;
const learningTools = [
  {icon: BookOpen, title: 'Create & teach', text: 'Build courses and lessons. Bring documents, videos and learning materials into one place.'},
  {icon: ClipboardCheck, title: 'Assess & give feedback', text: 'Set assignments and quizzes, review submissions and help learners see their next step.'},
  {icon: MessageSquare, title: 'Keep everyone connected', text: 'Share announcements, organize calendars and bring live-class links into the learning flow.'},
  {icon: TrendingUp, title: 'See learning progress', text: 'Follow course completion and assessment results in the right workspace for each role.'},
];
const faqs = [
  ['How do we get started?', 'Your platform administrator creates your organization. An organization administrator then adds staff and learners, sets up the academic structure or training batches, and assigns access. Existing users can log in with their current account.'],
  ['Can we use our own branding?', 'Yes. An organization administrator can set the institution name, logo and theme colors for its workspace. Those settings stay specific to your organization.'],
  ['How does AI-assisted content work?', 'AI Studio helps educators create editable drafts. Your organization needs an enabled AI provider before generation is available. An educator reviews the content and decides what to publish.'],
];

function BrandLockup() {
  return <a className="th-brand" href="/" aria-label="Tejasvi by Dursikshya — home">
    <img className="th-tejasvi-logo" src="/assets/tejasvi-campus-logo.svg" alt="Tejasvi" width={140} height={42}/>
    <span className="th-brand-divider" aria-hidden="true"/>
    <span className="th-parent-brand"><span>by</span><img src="/assets/dursikshya-logo.png" alt="Dursikshya" width={142} height={25}/></span>
  </a>;
}

const heroBanners = [
  {headline: ['A brighter day.', 'For every learner.'], description: 'From the first lesson to the last bell, bring your school community into one connected learning space.', note: 'Classes, lessons and progress — together.', badge: 'Ready for a new school day', detail: 'Learning starts with connection.'},
  {headline: ['Every semester.', 'A clearer path.'], description: 'Connect your campus through a shared space for subjects, teaching and student progress.', note: 'A learning space for your whole campus.', badge: 'Your next chapter starts here', detail: 'One campus. A connected experience.'},
  {headline: ['Build skills.', 'Move forward.'], description: 'Turn everyday training into meaningful progress. Help your people learn, grow and put new skills to work.', note: 'Onboarding and development, in focus.', badge: 'Make room for growth', detail: 'A learning culture for every team.'},
] as const;

function HeroCarousel({still, reduced, onToggleMotion, onExplore}: {still: boolean; reduced: boolean; onToggleMotion: () => void; onExplore: (index: number) => void}) {
  const [active, setActive] = useState(0), [auto, setAuto] = useState(true);
  const [hover, setHover] = useState(false), [visible, setVisible] = useState(true), [pageVisible, setPageVisible] = useState(true);
  const section = useRef<HTMLElement>(null), tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const touch = useRef<{x: number; y: number} | null>(null);
  const rotating = auto && !still && !hover && visible && pageVisible;
  const current = audiences[active], banner = heroBanners[active];
  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState === 'visible');
    update(); document.addEventListener('visibilitychange', update);
    const observer = new IntersectionObserver(entries => setVisible(entries[0].isIntersecting), {threshold: .2});
    if (section.current) observer.observe(section.current);
    return () => {observer.disconnect(); document.removeEventListener('visibilitychange', update);};
  }, []);
  useEffect(() => {
    if (!rotating) return;
    const timer = window.setInterval(() => setActive(value => (value + 1) % audiences.length), 7000);
    return () => window.clearInterval(timer);
  }, [rotating]);
  function select(index: number) {setActive((index + audiences.length) % audiences.length); setAuto(false);}
  return <section ref={section} className="th-hero-carousel th-container" aria-label="Tejasvi for schools, colleges and corporate teams" aria-roledescription="carousel"
    onPointerEnter={event => {if (event.pointerType === 'mouse') setHover(true);}} onPointerLeave={() => setHover(false)}
    onFocusCapture={event => {if (!(event.target as HTMLElement).closest('[data-hero-rotation], [data-page-motion]')) setAuto(false);}}>
    <div className="th-hero-toolbar"><span className="th-hero-kicker">ONE PLATFORM. MANY POSSIBILITIES.</span><button type="button" className="th-motion" data-page-motion aria-pressed={still} disabled={reduced} onClick={onToggleMotion} aria-label={reduced ? 'Motion reduced by your device settings' : still ? 'Resume page animations' : 'Pause page animations'}>{still ? <Play size={13}/> : <Pause size={13}/>}<span>{reduced ? 'Reduced motion' : still ? 'Motion paused' : 'Pause motion'}</span></button></div>
    <div id="th-hero-panel" role="tabpanel" aria-labelledby={'th-hero-tab-' + current.id} tabIndex={0} aria-live={rotating ? 'off' : 'polite'}
      onTouchStart={event => {touch.current = {x: event.touches[0].clientX, y: event.touches[0].clientY};}}
      onTouchCancel={() => {touch.current = null;}}
      onTouchEnd={event => {if (!touch.current) return; const dx = event.changedTouches[0].clientX - touch.current.x, dy = event.changedTouches[0].clientY - touch.current.y; if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.3) select(active + (dx < 0 ? 1 : -1)); touch.current = null;}}>
      <div key={current.id} className={'th-hero-banner th-banner-' + current.id}>
        <div className="th-hero-copy"><p className="th-eyebrow"><span/>TEJASVI FOR {current.label.toUpperCase()}</p><h1 id="hero-title">{banner.headline[0]}<br/><em>{banner.headline[1]}</em></h1><p className="th-hero-description">{banner.description}</p><div className="th-hero-actions"><a className="th-button th-button-orange" href="#solutions" onClick={() => onExplore(active)}>Explore {current.label.toLowerCase()} <ArrowRight size={18}/></a><a className="th-demo-link" href="/login">Open workspace <ArrowRight size={15}/></a></div><p className="th-hero-note">{banner.note}</p></div>
        <figure className="th-banner-visual"><div className="th-banner-photo"><img src={'/assets/joy/' + current.image + '.webp'} srcSet={'/assets/joy/' + current.image + '-small.webp 720w, /assets/joy/' + current.image + '.webp 1600w'} sizes="(max-width:760px) 92vw, 46vw" alt={current.alt} width={1600} height={current.id === 'college' ? 900 : 1067} fetchPriority={active === 0 ? 'high' : 'auto'} loading="eager"/><div className="th-banner-overlay"/><div className="th-banner-label"><current.icon size={23}/><span>Built for <strong>{current.label}</strong></span></div></div><div className="th-banner-note"><span><Check size={18}/></span><div><strong>{banner.badge}</strong><small>{banner.detail}</small></div></div><span className="th-banner-plus" aria-hidden="true">+</span></figure>
      </div>
    </div>
    <div className="th-hero-carousel-controls"><div className="th-hero-tabs" role="tablist" aria-label="Choose hero banner">{audiences.map((audience, index) => <button key={audience.id} type="button" ref={node => {tabs.current[index] = node;}} role="tab" id={'th-hero-tab-' + audience.id} aria-controls="th-hero-panel" aria-selected={active === index} tabIndex={active === index ? 0 : -1} onClick={() => select(index)} onKeyDown={event => {
      const next = event.key === 'ArrowRight' ? (index + 1) % audiences.length : event.key === 'ArrowLeft' ? (index + audiences.length - 1) % audiences.length : event.key === 'Home' ? 0 : event.key === 'End' ? audiences.length - 1 : null;
      if (next !== null) {event.preventDefault(); select(next); tabs.current[next]?.focus();}
    }}><span className="th-hero-tab-number">0{index + 1}</span>{audience.label}<span className="th-hero-tab-line" aria-hidden="true"/></button>)}</div><div className="th-slider-controls"><span className="th-slide-count" aria-hidden="true">0{active + 1}<i>/</i>03</span><button type="button" data-hero-rotation disabled={still} aria-label={auto && !still ? 'Pause hero rotation' : 'Play hero rotation'} onClick={() => setAuto(value => !value)}>{auto && !still ? <Pause size={17}/> : <Play size={17}/>}</button><button type="button" aria-label="Previous hero banner" onClick={() => select(active - 1)}><ChevronLeft size={19}/></button><button type="button" aria-label="Next hero banner" onClick={() => select(active + 1)}><ChevronRight size={19}/></button></div></div>
  </section>;
}

function AudienceSlider({still, active, setActive}: {still: boolean; active: number; setActive: Dispatch<SetStateAction<number>>}) {
  const [auto, setAuto] = useState(true);
  const [hover, setHover] = useState(false), [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const section = useRef<HTMLElement>(null), tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const touch = useRef<{x: number; y: number} | null>(null);
  const rotating = auto && !still && !hover && visible && pageVisible;
  const current = audiences[active];
  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState === 'visible');
    update(); document.addEventListener('visibilitychange', update);
    const observer = new IntersectionObserver(entries => setVisible(entries[0].isIntersecting), {threshold: .25});
    if (section.current) observer.observe(section.current);
    return () => {observer.disconnect(); document.removeEventListener('visibilitychange', update);};
  }, []);
  useEffect(() => {
    if (!rotating) return;
    const timer = window.setInterval(() => setActive(value => (value + 1) % audiences.length), 8000);
    return () => window.clearInterval(timer);
  }, [rotating]);
  function select(index: number) {setActive((index + audiences.length) % audiences.length); setAuto(false);}
  return <section ref={section} className="th-solutions" id="solutions" aria-labelledby="solutions-title"
    onPointerEnter={event => {if (event.pointerType === 'mouse') setHover(true);}} onPointerLeave={() => setHover(false)}
    onFocusCapture={event => {if (!(event.target as HTMLElement).closest('[data-rotation-control]')) setAuto(false);}}>
    <div className="th-container">
      <div className="th-section-heading"><div><p className="th-eyebrow">ONE PLATFORM. YOUR WORKFLOW.</p><h2 id="solutions-title">Built around your world.</h2></div><p>Choose your setting. <br/>Discover a workspace that fits.</p></div>
      <div className="th-slider-toolbar">
        <div className="th-audience-tabs" role="tablist" aria-label="Choose your institution">{audiences.map((audience, index) => <button key={audience.id} ref={node => {tabs.current[index] = node;}} type="button" role="tab" id={'th-tab-' + audience.id} aria-controls="th-audience-panel" aria-selected={active === index} tabIndex={active === index ? 0 : -1} onClick={() => select(index)} onKeyDown={event => {
          const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : null;
          if (next !== null) {event.preventDefault(); select(next); tabs.current[next]?.focus();}
        }}><audience.icon size={19}/>{audience.label}</button>)}</div>
        <div className="th-slider-controls"><span className="th-slide-count" aria-hidden="true">0{active + 1}<i>/</i>03</span><button type="button" data-rotation-control aria-label={auto && !still ? 'Pause slide rotation' : 'Play slide rotation'} disabled={still} onClick={() => setAuto(value => !value)}>{auto && !still ? <Pause size={17}/> : <Play size={17}/>}</button><button type="button" aria-label="Previous institution" onClick={() => select(active - 1)}><ChevronLeft size={19}/></button><button type="button" aria-label="Next institution" onClick={() => select(active + 1)}><ChevronRight size={19}/></button></div>
      </div>
      <div id="th-audience-panel" role="tabpanel" aria-labelledby={'th-tab-' + current.id} tabIndex={0} aria-live={rotating ? 'off' : 'polite'}
        onTouchStart={event => {touch.current = {x: event.touches[0].clientX, y: event.touches[0].clientY};}}
        onTouchEnd={event => {if (!touch.current) return; const dx = event.changedTouches[0].clientX - touch.current.x, dy = event.changedTouches[0].clientY - touch.current.y; if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.3) select(active + (dx < 0 ? 1 : -1)); touch.current = null;}}>
        <div className="th-audience-slide" key={current.id}>
          <div className={'th-audience-photo th-photo-' + current.id}><img src={'/assets/joy/' + current.image + '.webp'} srcSet={'/assets/joy/' + current.image + '-small.webp 720w, /assets/joy/' + current.image + '.webp 1600w'} sizes="(max-width: 760px) 94vw, 45vw" alt={current.alt} width={1600} height={1067} loading="lazy"/><div className="th-photo-caption"><current.icon size={22}/><span>Tejasvi for <strong>{current.label}</strong></span></div></div>
          <div className="th-audience-copy"><p className="th-eyebrow">{current.tag}</p><h3>{current.title.split('\n').map(line => <span key={line}>{line}</span>)}</h3><p className="th-audience-description">{current.description}</p><ol>{current.points.map(([title, text], index) => <li key={title}><span>0{index + 1}</span><div><h4>{title}</h4><p>{text}</p></div></li>)}</ol><a className="th-text-link" href='/login'>{current.cta}<ArrowUpRight size={18}/></a></div>
        </div>
        <div className="th-structure"><span>YOUR LEARNING STRUCTURE</span><ol>{current.structure.map((step, index) => <li key={step}>{index > 0 && <ChevronRight size={13} aria-hidden="true"/>}{step}</li>)}</ol></div>
      </div>
    </div>
  </section>;
}

export default function Home() {
  const [menu, setMenu] = useState(false), [quiet, setQuiet] = useState(false), [reduced, setReduced] = useState(false);
  const [solution, setSolution] = useState(0);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(preference.matches);
    update(); preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  const still = quiet || reduced;
  useEffect(() => {
    if (!still) return;
    const previous = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    return () => {document.documentElement.style.scrollBehavior = previous;};
  }, [still]);
  return <div className={'tejasvi-home' + (still ? ' th-still' : '')} id="top">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="th-header"><div className="th-container th-header-inner"><BrandLockup/><nav className="th-desktop-nav" aria-label="Main navigation">{navigation.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</nav><div className="th-header-actions"><a className="th-login" href={"/login"}>Log in <ArrowUpRight size={17}/></a><Sheet open={menu} onOpenChange={setMenu}><SheetTrigger asChild><button className="th-menu-toggle" aria-label="Open navigation"><Menu size={23}/></button></SheetTrigger><SheetContent className="th-mobile-menu"><SheetTitle>Explore Tejasvi</SheetTitle><SheetDescription>Learning management by Dursikshya.</SheetDescription><nav aria-label="Mobile navigation">{[...navigation, ['Log in', '/login']].map(([label, href]) => <a href={href} key={href} onClick={() => setMenu(false)}>{label}<ArrowUpRight size={18}/></a>)}</nav></SheetContent></Sheet></div></div></header>
    <main id="main">
      <HeroCarousel still={still} reduced={reduced} onToggleMotion={() => setQuiet(value => !value)} onExplore={setSolution}/>
      <AudienceSlider still={still} active={solution} setActive={setSolution}/>
      <section className="th-tools th-container" id="tools" aria-labelledby="tools-title"><div className="th-section-heading"><div><p className="th-eyebrow">THE EVERYDAY ESSENTIALS</p><h2 id="tools-title">Everything has its place.</h2></div><p>Less switching between tools. <br/>More focus on what comes next.</p></div><div className="th-tools-grid">{learningTools.map(tool => <article key={tool.title}><span className="th-tool-icon"><tool.icon size={25} strokeWidth={1.6}/></span><h3>{tool.title}</h3><p>{tool.text}</p></article>)}</div><div className="th-ai-note"><Sparkles size={21}/><p><strong>A helpful starting point with AI Studio.</strong> Turn a teaching idea into an editable draft. You review it before publishing.<span>Available when your organization enables AI generation.</span></p></div><p className="th-provider-note">Delivering training as an EdTech provider? Tejasvi also supports partner batches, instructors and learning programs.</p></section>
      <div className="th-device-showcase tejasvi-joy"><DeviceShowcase/></div>
      <section className="th-brand-section th-container" id="branding" aria-labelledby="branding-title"><div className="th-brand-panel"><div><p className="th-eyebrow">YOUR INSTITUTION. YOUR IDENTITY.</p><h2 id="branding-title">Make it feel<br/>like your own.</h2><p>Your name, your logo and your colors in the workspace your learners use every day.</p><ul><li><Check size={16}/>Organization branding</li><li><Check size={16}/>Access for each role</li><li><Check size={16}/>Layouts that adapt to mobile</li></ul></div><div className="th-demo-invite"><span className="th-demo-symbol"><GraduationCap size={27}/></span><h3>One account for your institution</h3><p>Schools and colleges can move between Learning and EMIS. Corporate teams have a dedicated Learning workspace.</p><a className="th-button th-button-white" href="/login">Open workspace <ArrowUpRight size={18}/></a></div></div></section>
      <section className="th-faq th-container" id="questions" aria-labelledby="faq-title"><div><p className="th-eyebrow">A GOOD PLACE TO START</p><h2 id="faq-title">A few questions,<br/>answered.</h2></div><div className="th-faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={18}/></summary><p>{answer}</p></details>)}</div></section>
    </main>
    <footer className="tf-footer" aria-labelledby="tf-name">
      <div className="th-container">
        <div className="tf-grid">
          <div className="tf-intro"><a href="/" className="tf-wordmark" id="tf-name" aria-label="Tejasvi home"><img src="/assets/tejasvi-campus-logo.svg" alt="Tejasvi" width="140" height="42"/></a>
            <p>One place for your institution to teach, learn and stay connected.</p><span className="tf-maker">A learning platform by Dursikshya</span></div>
          <nav aria-labelledby="tf-explore"><h2 id="tf-explore">Explore</h2><a href="#solutions">Who it’s for</a><a href="#tools">Learning tools</a><a href="#on-your-screen">Mobile access</a><a href="#branding">Your branding</a></nav>
          <nav aria-labelledby="tf-workspaces"><h2 id="tf-workspaces">Workspaces</h2><a href={'/login'}>Sign in to Tejasvi</a><a href='/workspaces'>My workspaces</a></nav>
          <div className="tf-help"><h2>Need a hand?</h2><p>For an account or password reset, contact your institution’s administrator.</p><a href="#questions">Common questions <ArrowUpRight size={15} aria-hidden="true"/></a></div>
        </div>
        <div className="tf-base"><span>© {new Date().getFullYear()} Tejasvi by Dursikshya</span><span className="tf-credit">Learning scenes are illustrations.</span><a href="#top">Back to top <span aria-hidden="true">↑</span></a></div>
      </div>
    </footer>
  </div>;
}
