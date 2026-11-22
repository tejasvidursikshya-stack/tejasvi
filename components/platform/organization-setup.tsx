'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowLeftRight, ArrowRight, Blocks, BriefcaseBusiness, CalendarDays, Check, ChevronDown,
  CircleAlert, FileText, GraduationCap, Mail, MapPin, Phone, School, Sparkles, type LucideIcon,
} from 'lucide-react';
import { academicYearLabel, adYearOfBs, bsYearOf, currentBsYear, normalizeAcademicYear } from '@/modules/emis/shared/bs.mjs';

const options = [
  { value: 'school', name: 'School', field: 'School', example: 'Sunrise Secondary School', icon: School, image: 'school', eyebrow: 'FOR CURIOUS MINDS', headline: 'Small discoveries. Big possibilities.', description: 'Learning and EMIS for classes, students and school operations.', tags: 'Grades · Sections · Subjects', intro: 'Set the name students and staff will see, and the academic year for your school records.' },
  { value: 'college', name: 'College', field: 'College', example: 'Valley College', icon: GraduationCap, image: 'college', eyebrow: 'FOR WHAT COMES NEXT', headline: 'A new chapter. A brighter future.', description: 'Learning and EMIS for programs, semesters and college operations.', tags: 'Faculties · Semesters · Subjects', intro: 'Set the name students and faculty will see, and the academic year for your college records.' },
  { value: 'corporate', name: 'Corporate', field: 'Company', example: 'Summit Industries', icon: BriefcaseBusiness, image: 'corporate', eyebrow: 'FOR TEAMS THAT GROW', headline: 'Fresh skills. Shared success.', description: 'Learning for employee training, cohorts and completion reports.', tags: 'Training · Batches · Certificates', intro: 'Use the company name your team will see when they sign in for training.' },
  { value: 'edtech', name: 'EdTech provider', field: 'Provider', example: 'Maker Learning Labs', icon: Blocks, image: 'teacher', eyebrow: 'FOR THE NEXT GENERATION', headline: 'Big ideas. Hands-on learning.', description: 'Coding, robotics and AI for partner schools and individual learners.', tags: 'Partner schools · B2C · Programs', intro: 'Use the provider name your partner schools and learners will see.' },
] as const;

type Option = (typeof options)[number];
function Field({ id, label, icon: Icon, hint, children }: {
  id: string; label: string; icon: LucideIcon; hint?:string; children: ReactNode;
}) {
  return <div className="org-details-field">
    <label htmlFor={id}>{label}</label>
    <div className="org-details-control"><Icon size={19} strokeWidth={1.7} aria-hidden="true"/>{children}</div>
    {hint && <small id={id+'-hint'}>{hint}</small>}
  </div>;
}

function AcademicYearField({ id }: { id: string }) {
  const [value, setValue] = useState(() => String(currentBsYear()));
  const stored = normalizeAcademicYear(value);
  const hint = stored
    ? `${academicYearLabel(stored)} · Baishakh ${bsYearOf(stored)} to Chaitra ${bsYearOf(stored)}`
    : 'Enter the year in Bikram Sambat, for example ' + currentBsYear() + ', or in AD as ' + adYearOfBs(currentBsYear()) + '.';
  return <Field id={id} label="Academic year (BS)" icon={CalendarDays} hint={hint}>
    <input id={id} name="academicYear" required maxLength={12} inputMode="numeric" value={value}
      aria-describedby={id+'-hint'} spellCheck={false} autoComplete="off" placeholder={'e.g. '+currentBsYear()}
      onChange={e=>{const v=e.currentTarget.value;setValue(v);e.currentTarget.setCustomValidity(normalizeAcademicYear(v)?'':'Enter the year in Bikram Sambat, for example '+currentBsYear()+', or in AD as '+adYearOfBs(currentBsYear())+'.');}}/>
  </Field>;
}

function Details({ selected, busy, active, onChangeType, error, titleRef, prefix }: {
  selected: Option; busy: boolean; active: boolean; onChangeType: () => void; error?: string;
  titleRef: React.RefObject<HTMLHeadingElement | null>; prefix: string;
}) {
  const isAcademic = selected.value === 'school' || selected.value === 'college';
  const Icon = selected.icon;
  const id = (key:string) => prefix+'-'+key;
  const docTitle = selected.value === 'corporate' ? 'company' : selected.value === 'edtech' ? 'provider' : selected.value;
  const optional = useRef<HTMLDetailsElement>(null);
  return <section className="org-details" aria-labelledby={id('title')}>
    <header className="org-details-header">
      <div className="org-details-topline">
        <span className="org-details-step"><span className="org-details-mark"><Icon size={23} aria-hidden="true"/></span>Step 2 of 2</span>
        <button type="button" className="org-details-change" disabled={busy} onClick={onChangeType}><ArrowLeftRight size={16} aria-hidden="true"/>Change type</button>
      </div>
      <h1 id={id('title')} ref={titleRef} tabIndex={-1}>Your {docTitle} details</h1>
      <p>{selected.intro}</p>
    </header>
    <fieldset className="org-details-body" disabled={busy || !active}>
      <legend className="org-sr-only">Details for the {selected.name.toLowerCase()} workspace</legend>
      <Field id={id('name')} label={selected.field+' name'} icon={Icon}>
        <input id={id('name')} name="name" autoComplete="organization" required pattern={'.*\\S.*'} maxLength={120} placeholder={'e.g. '+selected.example}/>
      </Field>
      {isAcademic && <AcademicYearField id={id('year')}/>}
      <details className="org-details-more" ref={optional} onInvalidCapture={()=>{if(optional.current) optional.current.open=true;}}>
        <summary><span>Contact &amp; registration</span><span className="org-details-optional">Optional</span><ChevronDown size={18} aria-hidden="true"/></summary>
        <div className="org-details-extra">
          <Field id={id('address')} label="Address" icon={MapPin}>
            <textarea id={id('address')} name="address" rows={2} autoComplete="street-address" maxLength={500} placeholder="Street, town or city"/>
          </Field>
          <Field id={id('email')} label="Contact email" icon={Mail}>
            <input id={id('email')} name="contactEmail" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} placeholder="office@example.org"/>
          </Field>
          <Field id={id('phone')} label="Phone" icon={Phone}>
            <input id={id('phone')} name="phone" type="tel" autoComplete="tel" maxLength={40} placeholder="Include the area or country code"/>
          </Field>
          <Field id={id('registration')} label="Registration number" icon={FileText}>
            <input id={id('registration')} name="registrationNumber" maxLength={100} placeholder="Official registration number"/>
          </Field>
        </div>
      </details>
      {error && <p className="org-details-error" role="alert"><CircleAlert size={18} aria-hidden="true"/>{error}</p>}
      <button className="org-details-submit" type="submit" disabled={busy}>{busy?'Creating…':'Create '+docTitle+' workspace'}<ArrowRight size={19} aria-hidden="true"/></button>
    </fieldset>
  </section>;
}

const defaultPhoto = (name:string) => '/assets/joy/'+name+'-small.webp';

export function OrganizationSetup({ busy, onSubmit, initialKind = '', error, photo = defaultPhoto }: {
  initialKind?: string; busy: boolean; error?: string; photo?: (name:string) => string; onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [kind,setKind] = useState(initialKind);
  const [choosing,setChoosing] = useState(!options.some(o=>o.value===initialKind));
  const selected = options.find(o=>o.value===kind);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const choiceRefs = useRef<Record<string,HTMLButtonElement|null>>({});
  const moveFocus = useRef(false);
  const prefix = useId();

  useEffect(()=>{
    if(!moveFocus.current) return;
    moveFocus.current=false;
    (choosing ? choiceRefs.current[kind] : titleRef.current)?.focus();
  },[choosing,kind]);
  function choose(value:Option['value']){moveFocus.current=true;setKind(value);setChoosing(false);}
  return <form className="org-bright-form" aria-busy={busy} onSubmit={e=>{
    if(busy || choosing || !selected){e.preventDefault();return;} onSubmit(e);
  }}>
    <input type="hidden" name="kind" value={kind}/>
    <div hidden={!choosing}>
      <header className="org-bright-heading">
        <span className="org-bright-kicker"><Sparkles size={15} aria-hidden="true"/> Step 1 of 2</span>
        <h1>Create an organization</h1><p>Choose the type of workspace you want to create.</p>
      </header>
      <fieldset disabled={busy||!choosing} className="org-bright-types"><legend>Choose organization type</legend>
        <div className="org-bright-grid">{options.map(({value,name,icon:Icon,image,eyebrow,headline,description,tags})=>
          <button key={value} type="button" className={'org-bright-card org-bright-'+value+(kind===value?' is-selected':'')}
            ref={node=>{choiceRefs.current[value]=node;}} onClick={()=>choose(value)} aria-label={'Choose '+name} aria-describedby={prefix+'-choice-'+value}>
            <span className="org-bright-art" aria-hidden="true"><img src={photo(image)} width={720} height={960} alt=""/><span className="org-bright-shade"/><span className="org-bright-cover"><Icon size={72} strokeWidth={1}/></span></span>
            <span className="org-bright-top"><span className="org-bright-eyebrow">{eyebrow}</span><strong>{name}</strong></span>
            <span className="org-bright-bottom"><span className="org-bright-headline">{headline}</span>
              <span className="org-bright-description" id={prefix+'-choice-'+value}>{description}</span><span className="org-bright-tags">{tags}</span>
              <span className="org-bright-select">{kind===value?'Continue with '+name.toLowerCase():'Choose '+name.toLowerCase()}<span>{kind===value?<Check size={18} aria-hidden="true"/>:<ArrowRight size={18} aria-hidden="true"/>}</span></span>
            </span>
          </button>)}</div>
      </fieldset>
    </div>
    {selected && <div hidden={choosing}><Details selected={selected} busy={busy} active={!choosing} error={error}
      titleRef={titleRef} prefix={prefix} onChangeType={()=>{moveFocus.current=true;setChoosing(true);}}/></div>}
  </form>;
}
