'use client';

import {useEffect, useRef, useState} from 'react';
import {ArrowRight, ArrowUpRight, ArrowDown, BookOpen, Check, ChevronDown, Sparkles, Play, Pause, Menu, ClipboardCheck, Palette, RotateCcw} from 'lucide-react';
import {InstitutionDeck} from '@/components/joy-institution-deck';
import {DeviceShowcase, ProviderPrograms} from '@/components/home-showcase';
import {LearningGallery, LaunchGuide} from '@/components/home-learning-gallery';
import {Sheet, SheetContent, SheetTitle, SheetTrigger} from '@/components/ui/sheet';
import '@/app/home-content.css';

const scenes = [
  {id: 'school', name: 'Schools', image: 'school', alt: 'Illustrative school scene: a teacher guiding students through a tablet activity'},
  {id: 'college', name: 'Colleges', image: 'college', alt: 'Illustrative college scene: students collaborating with a laptop and tablet'},
  {id: 'corporate', name: 'Corporates', image: 'corporate', alt: 'Illustrative corporate scene: colleagues in a workplace training session'},
];
const navigation = [['Solutions', '#communities'], ['Learning tools', '#experience'], ['Your brand', '#branding'], ['Try demo', '#demo']];
const faqs = [
  ['Who creates the first accounts?', 'An organization administrator sets up teachers and learners, then assigns their access. Students and employees use the same login page as staff; their account role determines the workspace they enter. Ask your administrator for your login details.'],
  ['What should we prepare for a student import?', 'Use the CSV template available in your organization’s student import screen. Set up the relevant faculty, semester or grade and batch first, complete the template’s required fields, and review any reported errors before retrying. Start with a small group to check the assignments.'],
  ['When will learners see a new lesson?', 'Once its content is published, it appears for learners with the relevant subject, course or batch access. Draft material stays out of the learner view. Check both publication status and enrolment if a learner cannot see a lesson.'],
  ['How do online classes work?', 'Teachers schedule a class and add its meeting link. Learners open that link from their class schedule. The live meeting runs with your chosen meeting provider; Tejasvi organizes the class information and access link.'],
  ['Does AI Studio publish content automatically?', 'No. AI Studio helps create drafts. An educator needs to review the accuracy, level and suitability before publishing. Your organization must configure its AI provider before using generation features.'],
];

export default function Home() {
  const root = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState(false);
  const [scene, setScene] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const [swatch, setSwatch] = useState(0);
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setReduced(q.matches); if (q.matches) setPlaying(false); };
    update(); q.addEventListener('change', update);
    return () => q.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (reduced || quiet || !root.current || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('jy-enter'); observer.unobserve(e.target); }
    }), {threshold: .12});
    root.current.querySelectorAll('.jy-reveal').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [reduced, quiet]);
  useEffect(() => {
    if (!playing || quiet || reduced) return;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') setScene(i => (i + 1) % scenes.length); }, 6500);
    return () => clearInterval(timer);
  }, [playing, quiet, reduced]);
  useEffect(() => {
    if (!quiet && !reduced) return;
    const previous = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    return () => { document.documentElement.style.scrollBehavior = previous; };
  }, [quiet, reduced]);
  const current = scenes[scene];
  const theme = ['#063868', '#426252', '#695386'][swatch];
  const toggleMotion = () => { setQuiet(v => !v); setPlaying(false); };

  return <div ref={root} className={'tejasvi-joy ' + (quiet || reduced ? 'jy-still' : '')} id="top">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="jy-header">
      <a href="#top" className="jy-logo" aria-label="Tejasvi home"><img src="/assets/tejasvi-campus-logo.svg" alt="Tejasvi" width={140} height={42}/></a>
      <nav className="jy-desktop" aria-label="Main navigation">{navigation.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</nav>
      <div className="jy-header-actions">
        <button className="jy-motion" aria-pressed={quiet || reduced} disabled={reduced} aria-label={reduced ? 'Animation is off in your device settings' : quiet ? 'Play decorative animations' : 'Pause decorative animations'} onClick={toggleMotion}>{quiet || reduced ? <Play size={13}/> : <Pause size={13}/>}<span>{quiet || reduced ? 'Motion off' : 'Pause motion'}</span></button>
        <a className="jy-login" href="/login">Log in <ArrowUpRight size={17}/></a>
        <Sheet open={menu} onOpenChange={setMenu}><SheetTrigger asChild><button className="jy-menu" aria-label="Open navigation"><Menu/></button></SheetTrigger><SheetContent className="jy-mobile-menu"><SheetTitle>Explore Tejasvi</SheetTitle><nav aria-label="Mobile navigation">{[...navigation, ['EdTech providers', '#beyond-the-classroom'], ['Getting started', '#getting-started'], ['Log in', '/login']].map(([label, href]) => <a key={href} href={href} onClick={() => setMenu(false)}>{label}<ArrowUpRight size={18}/></a>)}</nav></SheetContent></Sheet>
      </div>
    </header>
    <main id="main">
      <section className="jy-hero" aria-label="Welcome to Tejasvi">
        <div className="jy-hero-image" key={current.id}><img src={'/assets/joy/' + current.image + '.webp'} srcSet={'/assets/joy/' + current.image + '-small.webp 720w, /assets/joy/' + current.image + '.webp 1600w'} sizes="100vw" alt={current.alt} width={1600} height={current.image === 'college' ? 900 : 1067} loading="eager" fetchPriority="high"/></div>
        <div className="jy-hero-shade"/>
        <div className="jy-hero-copy">
          <p className="jy-eyebrow"><span/> TEJASVI LEARNING MANAGEMENT SYSTEM</p>
          <h1>Every lesson.<br/>Every learner.<br/><em>A clearer path.</em></h1>
          <p>Manage teaching, assessments and progress in a workspace built for your school, college or training organization.</p>
          <a className="jy-button jy-navy" href="#communities">Find your solution <ArrowUpRight size={19}/></a>
          <a className="jy-hero-demo" href="#experience">Explore the learning tools <ArrowRight size={16}/></a>
        </div>
        <span className="jy-hero-sticker" aria-hidden="true"><Sparkles size={20}/>Stay curious.</span>
        <div className="jy-hero-bottom"><a href="#communities" className="jy-scroll"><span><ArrowDown size={16}/></span> Built around the way you teach.</a><div className="jy-scenes" aria-label="Hero scenes">{scenes.map((c, i) => <button key={c.id} aria-label={'Show ' + c.name + ' scene'} aria-pressed={scene === i} onClick={() => { setScene(i); setPlaying(false); }}><span/> {c.name}</button>)}{!quiet && !reduced && <button className="jy-play" aria-label={playing ? 'Pause scene rotation' : 'Play scene rotation'} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={15}/> : <Play size={15}/>}</button>}</div></div>
      </section>

      <InstitutionDeck quiet={quiet || reduced}/>
      <LearningGallery quiet={quiet || reduced}/>

      <section className="jy-brand-section" id="branding" aria-labelledby="branding-title">
        <div className="jy-wrap jy-brand-grid">
          <div className="jy-brand-copy jy-reveal">
            <p className="jy-eyebrow">WHITE LABELING</p><h2 id="branding-title">Your identity.<br/><em>Inside the LMS.</em></h2>
            <p>Use your institution’s name, logo and theme colors in its signed-in workspace. Give learners a familiar place to return to.</p>
            <ul className="hc-brand-facts"><li><Check size={16}/> Organization name and logo</li><li><Check size={16}/> A color theme chosen by your administrator</li><li><Check size={16}/> Role-based workspaces for your community</li></ul>
            <p className="jy-swatch-label">Preview a workspace color</p>
            <div className="jy-swatches" aria-label="Preview theme colors">{['Navy', 'Forest', 'Lavender'].map((name, i) => <button key={name} aria-label={name + ' theme preview'} aria-pressed={swatch === i} onClick={() => setSwatch(i)} style={{background: ['#063868', '#426252', '#695386'][i]}}>{swatch === i && <Check size={16}/>}</button>)}<button className="jy-reset" onClick={() => setSwatch(0)} aria-label="Reset theme preview"><RotateCcw size={17}/></button></div>
            <small>Illustrative preview. No organization settings are changed.</small>
          </div>
          <div className="jy-brand-demo jy-reveal" style={{'--preview-theme': theme} as React.CSSProperties}>
            <div className="jy-brand-demo-top"><span><Palette size={23}/></span><div><strong>Your institution</strong><small>Your logo · Your colors</small></div><span className="jy-mini-avatar">A</span></div>
            <div className="jy-brand-demo-body"><p>YOUR COLLEGE WORKSPACE</p><h3>Welcome back, Aarav.</h3><div className="jy-brand-line"><span/><span/><span/></div><div className="jy-brand-blocks"><div><BookOpen size={23}/><strong>My subjects</strong></div><div><ClipboardCheck size={23}/><strong>My assessments</strong></div></div><span className="jy-brand-fake-button">Continue learning <ArrowRight size={17}/></span><small>Sample learner · Theme preview</small></div>
          </div>
        </div>
      </section>

      <ProviderPrograms quiet={quiet || reduced} reduced={reduced} onToggleMotion={toggleMotion}/>
      <DeviceShowcase/>
      
      <LaunchGuide quiet={quiet || reduced}/>

      <section className="jy-faq jy-wrap" id="questions" aria-labelledby="faq-title">
        <div className="jy-reveal"><p className="jy-eyebrow">BEFORE YOUR FIRST CLASS</p><h2 id="faq-title">A few practical<br/><em>answers.</em></h2></div>
        <div>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={20}/></summary><p>{answer}</p></details>)}</div>
      </section>
    </main>
    <footer className="jy-footer jy-wrap"><div><a className="jy-logo" href="#top" aria-label="Tejasvi home"><img src="/assets/tejasvi-campus-logo.svg" alt="Tejasvi" width={140} height={42} loading="lazy"/></a><p>Teaching organized. Learning connected.</p></div><nav aria-label="Footer navigation"><a href="#beyond-the-classroom">EdTech providers</a><a href="#on-your-screen">Mobile access</a><a href="#getting-started">Getting started</a><a href="#questions">FAQs</a><a href="/login">Log in</a></nav><div className="jy-footer-bottom"><span>© {new Date().getFullYear()} Tejasvi</span><span>Education and training imagery is AI-generated for illustration.</span></div></footer>
  </div>;
}
